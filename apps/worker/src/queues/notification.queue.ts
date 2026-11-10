import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createWorkerRedisConnection } from '../lib/redis.js';
import type { NotificationCategory, NotificationDeliveryStatus } from '@calmeter/shared';

export const NOTIFICATION_QUEUE_NAME = 'notification-dispatch';

export interface NotificationJobData {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, string>;
  bypassQuietHours?: boolean;
  dateIso: string; // YYYY-MM-DD for deterministic deduplication
}

export interface NotificationJobResult {
  status: NotificationDeliveryStatus;
  deviceCount: number;
  reason?: string;
}

export const defaultNotificationJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 3000,
  },
  removeOnComplete: {
    count: 2000,
  },
  removeOnFail: {
    count: 5000,
  },
};

export function createNotificationQueue(
  connection?: Redis,
): Queue<NotificationJobData, NotificationJobResult> {
  const redisConn = connection || createWorkerRedisConnection();

  return new Queue<NotificationJobData, NotificationJobResult>(NOTIFICATION_QUEUE_NAME, {
    connection: redisConn,
    defaultJobOptions: defaultNotificationJobOptions,
  });
}

/**
 * Enqueues a notification job with deterministic deduplication by userId, category, and dateIso.
 */
export async function enqueueNotificationJob(
  queue: Queue<NotificationJobData, NotificationJobResult>,
  data: NotificationJobData,
) {
  const cleanCategory = String(data.category).toLowerCase().replace(/_/g, '-');
  const jobId = `notif-${data.userId}-${cleanCategory}-${data.dateIso}`;

  return queue.add('dispatch-notification', data, {
    jobId,
  });
}
