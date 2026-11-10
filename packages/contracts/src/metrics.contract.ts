import { z } from 'zod';

export const MemoryUsageMetricSchema = z.object({
  heapUsedMb: z.number().nonnegative(),
  heapTotalMb: z.number().nonnegative(),
  rssMb: z.number().nonnegative(),
});

export const HttpLatencyMetricSchema = z.object({
  totalRequests: z.number().int().nonnegative(),
  statusCodes: z.record(z.number().int().nonnegative()),
  averageLatencyMs: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
});

export const WorkerMetricsSchema = z.object({
  activeJobs: z.number().int().nonnegative(),
  completedJobs: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  waitingJobs: z.number().int().nonnegative(),
});

export const AiUsageMetricsSchema = z.object({
  requestCount: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  averageLatencyMs: z.number().nonnegative(),
});

export const OperationalMetricsResponseSchema = z.object({
  service: z.string(),
  version: z.string(),
  environment: z.string(),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  memoryUsage: MemoryUsageMetricSchema,
  httpMetrics: HttpLatencyMetricSchema,
  workerMetrics: WorkerMetricsSchema.optional(),
  aiMetrics: AiUsageMetricsSchema.optional(),
});

export type OperationalMetricsResponse = z.infer<typeof OperationalMetricsResponseSchema>;
