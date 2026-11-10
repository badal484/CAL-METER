import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

let cachedWorkerConfig: WorkerEnv | null = null;

export function getWorkerConfig(): WorkerEnv {
  if (!cachedWorkerConfig) {
    const envToValidate = { ...process.env };
    if (process.env.NODE_ENV === 'test') {
      envToValidate.REDIS_URL = envToValidate.REDIS_URL || 'redis://localhost:6379';
    }
    const parsed = workerEnvSchema.safeParse(envToValidate);
    if (!parsed.success) {
      const errorDetails = parsed.error.issues
        .map(issue => ` - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(
        `[Worker Configuration Error] Invalid environment variables:\n${errorDetails}`,
      );
    }
    cachedWorkerConfig = parsed.data;
  }
  return cachedWorkerConfig;
}
