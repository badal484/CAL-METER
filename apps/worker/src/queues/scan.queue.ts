import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createWorkerRedisConnection } from '../lib/redis.js';

export const FOOD_SCAN_QUEUE_NAME = 'food-scans';

export interface FoodScanJobData {
  scanId: string;
  userId: string;
  storageKey: string;
}

export interface FoodScanJobResult {
  success: boolean;
  scanId: string;
  detectedItemCount: number;
}

export const defaultFoodScanJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,
  },
};

export function createFoodScanQueue(connection?: Redis): Queue<FoodScanJobData, FoodScanJobResult> {
  const redisConn = connection || createWorkerRedisConnection();

  return new Queue<FoodScanJobData, FoodScanJobResult>(FOOD_SCAN_QUEUE_NAME, {
    connection: redisConn,
    defaultJobOptions: defaultFoodScanJobOptions,
  });
}

export async function enqueueFoodScanJob(
  queue: Queue<FoodScanJobData, FoodScanJobResult>,
  data: FoodScanJobData,
) {
  // Use scanId as stable jobId to prevent duplicate enqueues for the same scan (BullMQ disallows colons in custom IDs)
  return queue.add('process-food-scan', data, {
    jobId: `scan-${data.scanId}`,
  });
}
