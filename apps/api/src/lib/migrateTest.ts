import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTestDatabaseUrl } from './testDbGuard.js';

export interface TestMigrationOptions {
  testDatabaseUrl?: string;
  nodeEnv?: string;
  databaseUrl?: string;
  schemaPath?: string;
  executor?: (validatedUrl: string, schemaPath: string) => Promise<void> | void;
  logger?: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Resolves the location of infrastructure/prisma/schema.prisma
 * across various execution contexts (monorepo root or package subdirectories).
 */
export function resolveSchemaPath(): string {
  const candidateRoot = path.resolve(process.cwd(), 'infrastructure/prisma/schema.prisma');
  if (fs.existsSync(candidateRoot)) {
    return candidateRoot;
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateFromModule = path.resolve(
    currentDir,
    '../../../../infrastructure/prisma/schema.prisma',
  );
  if (fs.existsSync(candidateFromModule)) {
    return candidateFromModule;
  }

  return candidateRoot;
}

/**
 * Executes `prisma migrate deploy` using the validated test database URL
 * passed explicitly as the DATABASE_URL environment variable.
 */
export function defaultPrismaExecutor(validatedUrl: string, schemaPath: string): void {
  const cleanEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: validatedUrl,
    TEST_DATABASE_URL: validatedUrl,
  };

  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy', `--schema=${schemaPath}`], {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
  } catch (err: unknown) {
    const error = err as { status?: number; stderr?: string; message?: string };
    const exitCode = error.status ?? 1;
    // Sanitize any database connection strings or credentials in stderr
    const sanitizedStderr = error.stderr
      ? error.stderr.replace(/postgresql:\/\/[^\s]+/g, '[REDACTED_DATABASE_URL]')
      : error.message || 'Prisma migration deploy execution failed';
    throw new Error(
      `[Test Migration Runner] Migration execution failed (exit code ${exitCode}): ${sanitizedStderr.trim()}`,
    );
  }
}

/**
 * Dedicated fail-closed test migration runner.
 * Enforces strict environment isolation and URL validation BEFORE Prisma
 * is permitted to run, ensuring zero chance of executing test migrations
 * against production or development databases.
 */
export async function runTestMigration(
  options?: TestMigrationOptions,
): Promise<{ dbName: string }> {
  const nodeEnv = options && 'nodeEnv' in options ? options.nodeEnv : process.env.NODE_ENV;
  const testDatabaseUrl =
    options && 'testDatabaseUrl' in options
      ? options.testDatabaseUrl
      : process.env.TEST_DATABASE_URL;
  const schemaPath = options?.schemaPath || resolveSchemaPath();
  const logger = options?.logger || console;

  // Fail-closed check: Never allow DATABASE_URL to rescue or substitute for missing TEST_DATABASE_URL
  if (!testDatabaseUrl || typeof testDatabaseUrl !== 'string' || testDatabaseUrl.trim() === '') {
    throw new Error(
      '[Test Migration Runner] TEST_DATABASE_URL is missing. Test migrations strictly require an explicitly configured TEST_DATABASE_URL and will never fall back to DATABASE_URL.',
    );
  }

  // Validate the URL using the unified test database guard
  const validated = validateTestDatabaseUrl(testDatabaseUrl, nodeEnv);

  logger.info(
    `[Test Migration Runner] Validated target test database: '${validated.dbName}'. Deploying migrations...`,
  );

  // Execute migration strictly with the validated test database URL
  const executor = options?.executor || defaultPrismaExecutor;
  await executor(validated.url, schemaPath);

  logger.info(`[Test Migration Runner] Migrations deployed successfully to '${validated.dbName}'.`);

  return { dbName: validated.dbName };
}
