export interface ValidatedTestDb {
  dbName: string;
  url: string;
}

const SENSITIVE_PARAM_NAMES = new Set([
  'password',
  'passwd',
  'token',
  'secret',
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'key',
  'credential',
]);

function isSensitiveParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (SENSITIVE_PARAM_NAMES.has(lower)) {
    return true;
  }
  return (
    lower.includes('password') ||
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('api_key') ||
    lower.includes('apikey')
  );
}

/**
 * Redacts username, password, and sensitive query parameters from a database
 * connection string to prevent accidental secret leakage in logs or diagnostics.
 *
 * For unparseable or malformed URLs that contain userinfo delimiters,
 * it returns a safe redacted placeholder so malformed credentials never leak.
 */
export function sanitizeDatabaseUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return '[EMPTY_DATABASE_URL]';
  }
  try {
    const parsed = new URL(url);
    if (parsed.username) {
      parsed.username = '***';
    }
    if (parsed.password) {
      parsed.password = '***';
    }
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveParam(key)) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, redact any embedded credentials or userinfo securely
    if (/:\/\/[^@\s]+@/.test(url)) {
      return '[REDACTED_DATABASE_URL]';
    }
    return '[UNPARSEABLE_DATABASE_URL]';
  }
}

/**
 * Centralized sanitization function for Prisma migration diagnostics, stderr,
 * and error messages.
 *
 * Requirements:
 * - Redacts postgresql:// and postgres:// connection URLs
 * - Redacts usernames, passwords, and sensitive query parameters (token, secret, api_key, etc.)
 * - Preserves useful non-sensitive diagnostic text (e.g. error codes, schema hints)
 * - Returns a generic safe fallback if credentials cannot be confidently removed
 */
export function sanitizeMigrationDiagnostic(text: string | undefined): string {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return 'Migration execution failed (no diagnostic output available).';
  }

  // 1. Strip ANSI escape sequences (terminal formatting/colors)
  // eslint-disable-next-line no-control-regex
  let sanitized = text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  // 2. Redact PostgreSQL and Postgres connection strings
  const dbUrlPattern = /postgres(?:ql)?:\/\/[^\s"'`<>]+/gi;
  sanitized = sanitized.replace(dbUrlPattern, match => {
    return sanitizeDatabaseUrl(match);
  });

  // 3. Redact any lingering userinfo patterns (e.g. //user:pass@host)
  sanitized = sanitized.replace(/\/\/[^/\s:@]+:[^/\s:@]+@/g, '//***:***@');

  // 4. Redact sensitive query parameters in any remaining URL fragments (?token=... or &password=...)
  sanitized = sanitized.replace(
    /([?&](?:password|passwd|token|secret|access_token|api_key|apikey)=)[^"'\s&,;`]+/gi,
    '$1***',
  );

  // 5. Redact sensitive key-value pairs (e.g. password=xyz, token=xyz, api_key=xyz, secret=xyz)
  const sensitiveKvPattern =
    /(?<=\b(?:password|passwd|token|secret|access_token|api_key|apikey)\s*[:=]\s*["']?)[^"'\s,;`&]+(?=["']?)/gi;
  sanitized = sanitized.replace(sensitiveKvPattern, '***');

  // 6. Redact environment variable connection strings (e.g. DATABASE_URL="...")
  sanitized = sanitized.replace(
    /((?:TEST_)?DATABASE_URL\s*=\s*["']?)(postgres(?:ql)?:\/\/[^"'\s]+)(["']?)/gi,
    (_match, prefix, val, suffix) => `${prefix}${sanitizeDatabaseUrl(val)}${suffix}`,
  );

  // 7. Fail-safe: Verify that no unredacted credential patterns linger.
  // If userinfo without asterisks remains, or unredacted sensitive parameters remain:
  const hasUnredactedUserInfo = /\/\/(?!\*\*\*:\*\*\*@)[^/\s:@]+:[^/\s:@]+@/.test(sanitized);
  const hasUnredactedSecretParam =
    /[?&](?:password|token|secret|access_token|api_key)=([^*&\s]+)/i.test(sanitized);

  if (hasUnredactedUserInfo || hasUnredactedSecretParam) {
    return 'Migration execution failed. Detailed diagnostics suppressed to prevent sensitive credential exposure.';
  }

  return sanitized.trim();
}

/**
 * Validates that the database connection URL for integration tests and test
 * migrations strictly targets an authorized, dedicated test database, preventing
 * accidental data deletion or mutation on development or production databases.
 *
 * Error messages are strictly sanitized: raw URLs containing credentials
 * are NEVER included in thrown exception messages.
 */
export function validateTestDatabaseUrl(
  url: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ValidatedTestDb {
  if (nodeEnv !== 'test') {
    throw new Error(
      `[Test Database Guard] Refusing to run database tests or migrations outside of NODE_ENV=test (current: '${nodeEnv || 'undefined'}').`,
    );
  }

  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      '[Test Database Guard] TEST_DATABASE_URL is missing. Integration tests and test migrations strictly require an explicit TEST_DATABASE_URL.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Sanitized: Do NOT include raw url in error to protect embedded credentials
    throw new Error(
      '[Test Database Guard] TEST_DATABASE_URL is not a valid or parseable URL format.',
    );
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
      `[Test Database Guard] Target database '${dbName}' is NOT a permitted test database. Database operations and test migrations are strictly restricted to dedicated test databases named 'calmeter_test' or ending with '_test'.`,
    );
  }

  return { dbName, url };
}
