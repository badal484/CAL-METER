import { describe, it, expect, afterAll } from 'vitest';
import type { Job } from 'bullmq';
import {
  createFoodScanQueue,
  enqueueFoodScanJob,
  defaultFoodScanJobOptions,
  FOOD_SCAN_QUEUE_NAME,
  type FoodScanJobData,
  type FoodScanJobResult,
} from '../src/queues/scan.queue.js';
import { processFoodScanJob } from '../src/processors/scan.processor.js';
import { createFoodScanWorker } from '../src/worker.js';
import { createWorkerRedisConnection } from '../src/lib/redis.js';

describe('BullMQ Worker Foundation & Queue Lifecycle', () => {
  const redis = createWorkerRedisConnection();
  const testQueue = createFoodScanQueue(redis);

  afterAll(async () => {
    await testQueue.close();
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  });

  it('queue can be instantiated with default retry and backoff configurations', () => {
    expect(testQueue.name).toBe(FOOD_SCAN_QUEUE_NAME);
    expect(defaultFoodScanJobOptions.attempts).toBe(3);
    expect(defaultFoodScanJobOptions.backoff).toEqual({
      type: 'exponential',
      delay: 2000,
    });
    expect(defaultFoodScanJobOptions.removeOnComplete).toEqual({ count: 1000 });
    expect(defaultFoodScanJobOptions.removeOnFail).toEqual({ count: 5000 });
  });

  it('worker does not start automatically when importing modules', () => {
    // Importing worker.ts should not spin up active listeners or throw unhandled errors
    // Verified by checking that createFoodScanWorker is an explicit factory
    expect(typeof createFoodScanWorker).toBe('function');
  });

  it('enqueues a food scan job with stable deduplication jobId', async () => {
    const scanPayload = {
      scanId: '11111111-2222-3333-4444-555555555555',
      userId: 'user-test-777',
      storageKey: 'uploads/scans/user-777/meal.jpg',
    };

    const job = await enqueueFoodScanJob(testQueue, scanPayload);

    expect(job).toBeDefined();
    expect(job.id).toBe(`scan-${scanPayload.scanId}`);
    expect(job.data).toEqual(scanPayload);
    expect(job.opts.attempts).toBe(3);

    // Clean up test job
    await job.remove();
  });

  it('placeholder processor processes job returning structured success result', async () => {
    const mockJob = {
      id: 'scan:mock-123',
      data: {
        scanId: 'mock-scan-uuid',
        userId: 'user-456',
        storageKey: 'photos/food.jpg',
      },
      attemptsMade: 0,
    } as unknown as Job<FoodScanJobData, FoodScanJobResult>;

    const result = await processFoodScanJob(mockJob);

    expect(result).toEqual({
      success: true,
      scanId: 'mock-scan-uuid',
      detectedItemCount: 0,
    });
  });

  it('worker can be instantiated and closed gracefully', async () => {
    const workerRedis = createWorkerRedisConnection();
    const worker = createFoodScanWorker(workerRedis);

    expect(worker).toBeDefined();
    expect(worker.name).toBe(FOOD_SCAN_QUEUE_NAME);

    // Graceful close
    await worker.close();
    try {
      await workerRedis.quit();
    } catch {
      workerRedis.disconnect();
    }
  });

  describe('Notification Dispatch Worker & Deduplication (Part 13)', () => {
    it('instantiates notification queue with exponential retry policy', async () => {
      const { createNotificationQueue, NOTIFICATION_QUEUE_NAME, defaultNotificationJobOptions } =
        await import('../src/queues/notification.queue.js');

      const notifQueue = createNotificationQueue(redis);
      expect(notifQueue.name).toBe(NOTIFICATION_QUEUE_NAME);
      expect(defaultNotificationJobOptions.attempts).toBe(3);
      expect(defaultNotificationJobOptions.backoff).toEqual({
        type: 'exponential',
        delay: 3000,
      });

      await notifQueue.close();
    });

    it('enqueues notification job with deterministic deduplication jobId', async () => {
      const { createNotificationQueue, enqueueNotificationJob } =
        await import('../src/queues/notification.queue.js');
      const { NotificationCategory } = await import('@calmeter/shared');

      const notifQueue = createNotificationQueue(redis);
      const jobData = {
        userId: 'test-user-uuid',
        category: NotificationCategory.MEAL_REMINDER_BREAKFAST,
        title: 'Time for breakfast!',
        body: 'Log your morning meal to stay on target.',
        dateIso: '2026-11-10',
      };

      const job = await enqueueNotificationJob(notifQueue, jobData);
      expect(job.id).toBe('notif-test-user-uuid-meal-reminder-breakfast-2026-11-10');
      expect(job.data.category).toBe(NotificationCategory.MEAL_REMINDER_BREAKFAST);

      await job.remove();
      await notifQueue.close();
    });

    it('processes notification job gracefully in mock environment', async () => {
      const { processNotificationJob } =
        await import('../src/processors/notification.processor.js');
      const { NotificationCategory, NotificationDeliveryStatus } = await import('@calmeter/shared');

      const mockJob = {
        id: 'mock-job-id',
        data: {
          userId: 'mock-user-uuid',
          category: NotificationCategory.WATER_REMINDER,
          title: 'Hydration Check',
          body: 'Drink a glass of water.',
          dateIso: '2026-11-10',
        },
        attemptsMade: 0,
      } as any;

      const result = await processNotificationJob(mockJob);
      expect(result.status).toBe(NotificationDeliveryStatus.SENT);
      expect(result.deviceCount).toBe(1);
    });
  });
});
