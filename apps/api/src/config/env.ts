import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    TEST_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:8081'),
    MAX_REQUEST_SIZE: z.string().default('100kb'),
    TRUST_PROXY: z.string().default('false'),
    FIREBASE_CREDENTIAL_MODE: z.enum(['application-default', 'service-account']).optional(),
    FIREBASE_PROJECT_ID: z
      .string()
      .min(1, 'FIREBASE_PROJECT_ID is required')
      .regex(/^[a-z0-9-]+$/, 'FIREBASE_PROJECT_ID must be a valid GCP/Firebase project identifier')
      .default('calmeter-dev'),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    REVENUECAT_WEBHOOK_AUTH_TOKEN: z.string().optional(),
    REVENUECAT_SECRET_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // In production, credential mode must be explicitly chosen
    if (data.NODE_ENV === 'production' && !data.FIREBASE_CREDENTIAL_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FIREBASE_CREDENTIAL_MODE'],
        message:
          'FIREBASE_CREDENTIAL_MODE must be explicitly configured in production (choose either "application-default" or "service-account").',
      });
    }

    const effectiveMode = data.FIREBASE_CREDENTIAL_MODE || 'application-default';

    if (effectiveMode === 'service-account') {
      if (!data.FIREBASE_CLIENT_EMAIL || data.FIREBASE_CLIENT_EMAIL.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FIREBASE_CLIENT_EMAIL'],
          message:
            'FIREBASE_CLIENT_EMAIL is required when FIREBASE_CREDENTIAL_MODE is "service-account".',
        });
      }
      if (!data.FIREBASE_PRIVATE_KEY || data.FIREBASE_PRIVATE_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FIREBASE_PRIVATE_KEY'],
          message:
            'FIREBASE_PRIVATE_KEY is required when FIREBASE_CREDENTIAL_MODE is "service-account".',
        });
      }
    }
  });

export type RawApiEnv = z.infer<typeof envSchema>;

export type ParsedTrustProxy = boolean | number | string;

export function parseTrustProxy(value: string): ParsedTrustProxy {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'false' || trimmed === '0' || trimmed === '') {
    return false;
  }
  if (trimmed === 'true') {
    return true;
  }
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }
  // Otherwise return string specification (e.g. 'loopback, linklocal')
  return value.trim();
}

export interface ApiConfig extends Omit<RawApiEnv, 'FIREBASE_CREDENTIAL_MODE'> {
  FIREBASE_CREDENTIAL_MODE: 'application-default' | 'service-account';
  parsedTrustProxy: ParsedTrustProxy;
  corsOrigins: string[];
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
}

export function validateEnv(env: Record<string, string | undefined> = process.env): ApiConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map(issue => ` - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`[Configuration Error] Invalid environment variables:\n${errorDetails}`);
  }

  const data = parsed.data;
  const corsOrigins = data.CORS_ORIGIN.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const effectiveMode =
    data.FIREBASE_CREDENTIAL_MODE ||
    (data.NODE_ENV === 'test' ? 'application-default' : 'application-default');

  return {
    ...data,
    FIREBASE_CREDENTIAL_MODE: effectiveMode,
    parsedTrustProxy: parseTrustProxy(data.TRUST_PROXY),
    corsOrigins,
    isProduction: data.NODE_ENV === 'production',
    isTest: data.NODE_ENV === 'test',
    isDevelopment: data.NODE_ENV === 'development',
  };
}

let cachedConfig: ApiConfig | null = null;

export function getConfig(): ApiConfig {
  if (!cachedConfig) {
    // Provide sensible test fallbacks if in test environment and not explicitly set
    const envToValidate = { ...process.env };
    if (process.env.NODE_ENV === 'test') {
      envToValidate.DATABASE_URL =
        envToValidate.DATABASE_URL || 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
      envToValidate.TEST_DATABASE_URL =
        envToValidate.TEST_DATABASE_URL ||
        'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
      envToValidate.REDIS_URL = envToValidate.REDIS_URL || 'redis://localhost:6379';
    }
    cachedConfig = validateEnv(envToValidate);
  }
  return cachedConfig;
}

export function resetConfigForTesting(newConfig?: ApiConfig): void {
  cachedConfig = newConfig || null;
}
