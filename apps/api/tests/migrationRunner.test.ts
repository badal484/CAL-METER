import { describe, it, expect, vi } from 'vitest';
import { runTestMigration } from '../src/lib/migrateTest.js';
import {
  validateTestDatabaseUrl,
  sanitizeDatabaseUrl,
  sanitizeMigrationDiagnostic,
} from '../src/lib/testDbGuard.js';

describe('Test Migration Runner & Guard Safety Isolation', () => {
  it('rejects execution when TEST_DATABASE_URL is missing', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: undefined,
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/TEST_DATABASE_URL is missing/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects execution when TEST_DATABASE_URL is empty or whitespace', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: '',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/TEST_DATABASE_URL is missing/i);

    await expect(
      runTestMigration({
        testDatabaseUrl: '   ',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/TEST_DATABASE_URL is missing/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects execution when NODE_ENV is development', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        nodeEnv: 'development',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/Refusing to run database tests or migrations outside of NODE_ENV=test/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects execution when NODE_ENV is production', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        nodeEnv: 'production',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/Refusing to run database tests or migrations outside of NODE_ENV=test/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects a _dev database target', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_dev',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/Target database 'calmeter_dev' is NOT a permitted test database/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects a _prod database target', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_prod',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/Target database 'calmeter_prod' is NOT a permitted test database/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects a staging database target', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_staging',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/is NOT a permitted test database/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('rejects generic postgres and calmeter database targets', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://postgres:postgres@localhost:5432/postgres',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/Target database 'postgres' is NOT a permitted test database/i);

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/Target database 'calmeter' is NOT a permitted test database/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('accepts a valid calmeter_test database target', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(undefined);

    const result = await runTestMigration({
      testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
      nodeEnv: 'test',
      executor: mockExecutor,
    });

    expect(result.dbName).toBe('calmeter_test');
    expect(mockExecutor).toHaveBeenCalledTimes(1);
    expect(mockExecutor).toHaveBeenCalledWith(
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
      expect.any(String),
    );
  });

  it('accepts a valid database target ending in _test', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(undefined);

    const result = await runTestMigration({
      testDatabaseUrl: 'postgresql://ci_runner:pass@localhost:5432/my_isolated_suite_test',
      nodeEnv: 'test',
      executor: mockExecutor,
    });

    expect(result.dbName).toBe('my_isolated_suite_test');
    expect(mockExecutor).toHaveBeenCalledTimes(1);
    expect(mockExecutor).toHaveBeenCalledWith(
      'postgresql://ci_runner:pass@localhost:5432/my_isolated_suite_test',
      expect.any(String),
    );
  });

  it('proves a production DATABASE_URL cannot override a valid test database selection', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(undefined);

    const result = await runTestMigration({
      testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
      databaseUrl: 'postgresql://admin:superSecret@db.prod.internal:5432/calmeter_prod',
      nodeEnv: 'test',
      executor: mockExecutor,
    });

    expect(result.dbName).toBe('calmeter_test');
    // Prisma executor MUST strictly receive the validated TEST_DATABASE_URL
    expect(mockExecutor).toHaveBeenCalledWith(
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
      expect.any(String),
    );
    expect(mockExecutor).not.toHaveBeenCalledWith(
      expect.stringContaining('calmeter_prod'),
      expect.any(String),
    );
  });

  it('proves a production DATABASE_URL cannot rescue a missing TEST_DATABASE_URL', async () => {
    const mockExecutor = vi.fn();

    await expect(
      runTestMigration({
        testDatabaseUrl: undefined,
        databaseUrl: 'postgresql://admin:superSecret@db.prod.internal:5432/calmeter_prod',
        nodeEnv: 'test',
        executor: mockExecutor,
      }),
    ).rejects.toThrow(/TEST_DATABASE_URL is missing/i);

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('proves invalid configuration does not invoke Prisma or establish a database connection', async () => {
    const mockExecutor = vi.fn();

    const invalidConfigs = [
      { testDatabaseUrl: undefined, nodeEnv: 'test' },
      { testDatabaseUrl: '', nodeEnv: 'test' },
      {
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_dev',
        nodeEnv: 'test',
      },
      {
        testDatabaseUrl: 'postgresql://prod_user:secret@db.prod.internal:5432/calmeter_prod',
        nodeEnv: 'test',
      },
      {
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        nodeEnv: 'development',
      },
      { testDatabaseUrl: 'http://localhost:5432/calmeter_test', nodeEnv: 'test' },
    ];

    for (const config of invalidConfigs) {
      await expect(
        runTestMigration({
          ...config,
          executor: mockExecutor,
        }),
      ).rejects.toThrow();
    }

    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('propagates Prisma execution failure with non-zero error and sanitized message', async () => {
    const failingExecutor = vi.fn().mockImplementation(() => {
      throw new Error(
        sanitizeMigrationDiagnostic(
          'Prisma migrate deploy failed: connection error to postgresql://secretUser:secretPass@localhost:5432/calmeter_test',
        ),
      );
    });

    const mockLogger = { info: vi.fn(), error: vi.fn() };

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        nodeEnv: 'test',
        executor: failingExecutor,
        logger: mockLogger,
      }),
    ).rejects.toThrow(/Prisma migrate deploy failed/i);

    // Verify raw secret is never logged
    expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('secretPass'));
    expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('secretPass'));
  });
});

describe('Diagnostic & Error Message Sanitization (Zero Secret Leakage)', () => {
  const sensitiveUser = 'superAdminUser99';
  const sensitivePass = 'p@ssword_top_secret_XYZ!';
  const sensitiveToken = 'bearer_token_abc_123_SECRET';
  const sensitiveApiKey = 'api_key_live_liveKeySecret999';

  it('redacts postgresql:// URLs containing username and password', () => {
    const rawError = `Error: P1001: Can't reach database server at postgresql://${sensitiveUser}:${sensitivePass}@db.internal:5432/calmeter_test. Please ensure PostgreSQL is running.`;
    const sanitized = sanitizeMigrationDiagnostic(rawError);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).toContain('postgresql://***:***@db.internal:5432/calmeter_test');
    expect(sanitized).toContain("Can't reach database server at");
    expect(sanitized).toContain('Please ensure PostgreSQL is running.');
  });

  it('redacts postgres:// URLs containing username and password', () => {
    const rawError = `PrismaClientInitializationError: Failed to connect to postgres://${sensitiveUser}:${sensitivePass}@postgres.local:5432/calmeter_test`;
    const sanitized = sanitizeMigrationDiagnostic(rawError);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).toContain('postgres://***:***@postgres.local:5432/calmeter_test');
    expect(sanitized).toContain('PrismaClientInitializationError: Failed to connect to');
  });

  it('redacts URL query parameters containing password, token, secret, access_token, and api_key', () => {
    const rawError = `Connection failed: postgresql://${sensitiveUser}:${sensitivePass}@localhost:5432/calmeter_test?sslmode=require&password=queryPasswordVal&token=${sensitiveToken}&access_token=tokenVal123&api_key=${sensitiveApiKey}&secret=secretValXYZ`;
    const sanitized = sanitizeMigrationDiagnostic(rawError);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).not.toContain('queryPasswordVal');
    expect(sanitized).not.toContain(sensitiveToken);
    expect(sanitized).not.toContain('tokenVal123');
    expect(sanitized).not.toContain(sensitiveApiKey);
    expect(sanitized).not.toContain('secretValXYZ');

    expect(sanitized).toContain('password=***');
    expect(sanitized).toContain('token=***');
    expect(sanitized).toContain('access_token=***');
    expect(sanitized).toContain('api_key=***');
    expect(sanitized).toContain('secret=***');
    expect(sanitized).toContain('sslmode=require');
  });

  it('redacts Prisma error messages containing embedded database URLs and environment assignments', () => {
    const rawPrismaError = `
      Error: P1000: Authentication failed against database server at postgresql://${sensitiveUser}:${sensitivePass}@10.0.0.1:5432/calmeter_test
      Environment variable DATABASE_URL="postgresql://${sensitiveUser}:${sensitivePass}@10.0.0.1:5432/calmeter_test"
      The provided database user cannot be authenticated.
    `;
    const sanitized = sanitizeMigrationDiagnostic(rawPrismaError);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).toContain('Error: P1000: Authentication failed against database server at');
    expect(sanitized).toContain('DATABASE_URL="postgresql://***:***@10.0.0.1:5432/calmeter_test"');
    expect(sanitized).toContain('The provided database user cannot be authenticated.');
  });

  it('redacts unparseable or malformed connection strings containing credentials', () => {
    const malformedRaw = `P1013: The provided database string is invalid: postgresql://${sensitiveUser}:${sensitivePass}@bad^domain:5432/calmeter_test`;
    const sanitized = sanitizeMigrationDiagnostic(malformedRaw);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).toContain('[REDACTED_DATABASE_URL]');
    expect(sanitized).toContain('P1013: The provided database string is invalid:');
  });

  it('redacts sensitive standalone key-value parameters outside URLs', () => {
    const standaloneError = `Prisma error detail: password=${sensitivePass} token=${sensitiveToken} api_key=${sensitiveApiKey} secret=super_secret_val`;
    const sanitized = sanitizeMigrationDiagnostic(standaloneError);

    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).not.toContain(sensitiveToken);
    expect(sanitized).not.toContain(sensitiveApiKey);
    expect(sanitized).not.toContain('super_secret_val');

    expect(sanitized).toContain('password=***');
    expect(sanitized).toContain('token=***');
    expect(sanitized).toContain('api_key=***');
    expect(sanitized).toContain('secret=***');
  });

  it('failsafe fallback: returns generic safe message if credentials cannot be confidently removed', () => {
    // A string with an unredactable credential structure
    const complexSuspiciousText = `Corrupted diagnostic: //${sensitiveUser}:${sensitivePass}@unparseable-pattern`;
    const sanitized = sanitizeMigrationDiagnostic(complexSuspiciousText);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
  });
});

describe('Test Database Guard: Credential Sanitization in Validation Errors', () => {
  const sensitiveUser = 'superAdminUser99';
  const sensitivePass = 'p@ssword_top_secret_XYZ!';

  it('never leaks username or password in unparseable URL error messages', () => {
    const malformedUrlWithCredentials = `postgresql://${sensitiveUser}:${sensitivePass}@bad^domain:5432/calmeter_test`;

    try {
      validateTestDatabaseUrl(malformedUrlWithCredentials, 'test');
      expect.unreachable('Should have thrown an error');
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).not.toContain(sensitiveUser);
      expect(message).not.toContain(sensitivePass);
      expect(message).toContain('TEST_DATABASE_URL is not a valid or parseable URL format');
    }
  });

  it('never leaks username or password when rejecting prohibited database targets', () => {
    const devUrlWithCredentials = `postgresql://${sensitiveUser}:${sensitivePass}@localhost:5432/calmeter_dev`;

    try {
      validateTestDatabaseUrl(devUrlWithCredentials, 'test');
      expect.unreachable('Should have thrown an error');
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).not.toContain(sensitiveUser);
      expect(message).not.toContain(sensitivePass);
      expect(message).toContain("Target database 'calmeter_dev' is NOT a permitted test database");
    }

    const prodUrlWithCredentials = `postgresql://${sensitiveUser}:${sensitivePass}@db.prod.internal:5432/calmeter_prod`;

    try {
      validateTestDatabaseUrl(prodUrlWithCredentials, 'test');
      expect.unreachable('Should have thrown an error');
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).not.toContain(sensitiveUser);
      expect(message).not.toContain(sensitivePass);
      expect(message).toContain("Target database 'calmeter_prod' is NOT a permitted test database");
    }
  });

  it('never leaks username or password when rejecting invalid protocols', () => {
    const mysqlUrlWithCredentials = `mysql://${sensitiveUser}:${sensitivePass}@localhost:3306/calmeter_test`;

    try {
      validateTestDatabaseUrl(mysqlUrlWithCredentials, 'test');
      expect.unreachable('Should have thrown an error');
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).not.toContain(sensitiveUser);
      expect(message).not.toContain(sensitivePass);
      expect(message).toContain('must use postgresql: protocol');
    }
  });

  it('sanitizeDatabaseUrl helper redacts username, password, and sensitive query params', () => {
    const rawUrl = `postgresql://${sensitiveUser}:${sensitivePass}@localhost:5432/calmeter_test?sslmode=disable&token=tokSecret123&password=passSecret456`;
    const sanitized = sanitizeDatabaseUrl(rawUrl);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).not.toContain('tokSecret123');
    expect(sanitized).not.toContain('passSecret456');
    expect(sanitized).toContain('***:***@localhost:5432/calmeter_test');
    expect(sanitized).toContain('token=***');
    expect(sanitized).toContain('password=***');
    expect(sanitized).toContain('sslmode=disable');
  });
});
