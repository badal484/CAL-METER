import { describe, it, expect, vi } from 'vitest';
import { runTestMigration } from '../src/lib/migrateTest.js';
import { validateTestDatabaseUrl, sanitizeDatabaseUrl } from '../src/lib/testDbGuard.js';

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

    // Even if process.env.DATABASE_URL or options.databaseUrl points to production
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

    // When TEST_DATABASE_URL is missing, DATABASE_URL must NOT be used as a fallback
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

    // Proves Prisma executor was NEVER invoked across all invalid configs
    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('propagates Prisma execution failure with non-zero error', async () => {
    const failingExecutor = vi.fn().mockImplementation(() => {
      throw new Error('Prisma schema migration failed: syntax error in migration.sql');
    });

    await expect(
      runTestMigration({
        testDatabaseUrl: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        nodeEnv: 'test',
        executor: failingExecutor,
      }),
    ).rejects.toThrow(/Prisma schema migration failed/i);
  });
});

describe('Test Database Guard: Credential Sanitization & Protection', () => {
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

  it('sanitizeDatabaseUrl helper redacts username and password', () => {
    const rawUrl = `postgresql://${sensitiveUser}:${sensitivePass}@localhost:5432/calmeter_test?sslmode=disable`;
    const sanitized = sanitizeDatabaseUrl(rawUrl);

    expect(sanitized).not.toContain(sensitiveUser);
    expect(sanitized).not.toContain(sensitivePass);
    expect(sanitized).toContain('***:***@localhost:5432/calmeter_test');
  });
});
