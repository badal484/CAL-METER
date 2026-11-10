export interface ValidatedTestDb {
  dbName: string;
  url: string;
}

/**
 * Validates that the database connection URL for integration tests strictly
 * targets an authorized, dedicated test database, preventing accidental
 * data deletion or mutation on development or production databases.
 */
export function validateTestDatabaseUrl(
  url: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ValidatedTestDb {
  if (nodeEnv !== 'test') {
    throw new Error(
      `[Test Database Guard] Refusing to run database tests outside of NODE_ENV=test (current: '${nodeEnv || 'undefined'}').`,
    );
  }

  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      '[Test Database Guard] TEST_DATABASE_URL is missing. Integration tests strictly require an explicit TEST_DATABASE_URL.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[Test Database Guard] TEST_DATABASE_URL is not a valid URL: '${url}'.`);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `[Test Database Guard] TEST_DATABASE_URL must use postgresql: protocol (received: '${parsed.protocol}').`,
    );
  }

  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0] || '';

  if (!dbName) {
    throw new Error(
      '[Test Database Guard] TEST_DATABASE_URL does not specify a target database name.',
    );
  }

  // Reject any database containing dev, staging, or prod designations
  const hasDevOrProdToken =
    dbName.includes('prod') ||
    dbName.includes('production') ||
    dbName.includes('dev') ||
    dbName.includes('development') ||
    dbName.includes('stage') ||
    dbName.includes('staging') ||
    dbName === 'postgres' ||
    dbName === 'calmeter';

  const isExplicitTestDb = dbName === 'calmeter_test' || dbName.endsWith('_test');

  if (hasDevOrProdToken || !isExplicitTestDb) {
    throw new Error(
      `[Test Database Guard] Target database '${dbName}' is NOT a permitted test database. Database integration tests are strictly restricted to dedicated test databases named 'calmeter_test' or ending with '_test'.`,
    );
  }

  return { dbName, url };
}
