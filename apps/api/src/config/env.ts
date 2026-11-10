import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:8081'),
  MAX_REQUEST_SIZE: z.string().default('100kb'),
  FIREBASE_PROJECT_ID: z.string().min(1).default('calmeter-dev'),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type RawApiEnv = z.infer<typeof envSchema>;

export interface ApiConfig extends RawApiEnv {
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

  return {
    ...data,
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
      envToValidate.REDIS_URL = envToValidate.REDIS_URL || 'redis://localhost:6379';
    }
    cachedConfig = validateEnv(envToValidate);
  }
  return cachedConfig;
}

export function resetConfigForTesting(newConfig?: ApiConfig): void {
  cachedConfig = newConfig || null;
}
