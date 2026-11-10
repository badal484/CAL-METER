import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { getWorkerConfig } from './config/env.js';
import { createWorkerRedisConnection } from './lib/redis.js';
import { workerLogger } from './lib/logger.js';
import {
  FOOD_SCAN_QUEUE_NAME,
  type FoodScanJobData,
  type FoodScanJobResult,
} from './queues/scan.queue.js';
import { processFoodScanJob } from './processors/scan.processor.js';
import {
  NOTIFICATION_QUEUE_NAME,
  type NotificationJobData,
  type NotificationJobResult,
} from './queues/notification.queue.js';
import { processNotificationJob } from './processors/notification.processor.js';

export function createFoodScanWorker(
  connection?: Redis,
): Worker<FoodScanJobData, FoodScanJobResult> {
  const config = getWorkerConfig();
  const redisConn = connection || createWorkerRedisConnection();

  const worker = new Worker<FoodScanJobData, FoodScanJobResult>(
    FOOD_SCAN_QUEUE_NAME,
    processFoodScanJob,
    {
      connection: redisConn,
      concurrency: config.CONCURRENCY,
    },
  );

  worker.on('completed', (job, result) => {
    workerLogger.info({ jobId: job.id, result }, 'Food scan job completed successfully');
  });

  worker.on('failed', (job, err) => {
    workerLogger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
      'Food scan job failed',
    );
  });

  worker.on('error', err => {
    workerLogger.error({ err: err.message }, 'BullMQ scan worker encountered an error');
  });

  return worker;
}

export function createNotificationWorker(
  connection?: Redis,
): Worker<NotificationJobData, NotificationJobResult> {
  const config = getWorkerConfig();
  const redisConn = connection || createWorkerRedisConnection();

  const worker = new Worker<NotificationJobData, NotificationJobResult>(
    NOTIFICATION_QUEUE_NAME,
    processNotificationJob,
    {
      connection: redisConn,
      concurrency: config.CONCURRENCY,
    },
  );

  worker.on('completed', (job, result) => {
    workerLogger.info({ jobId: job.id, result }, 'Notification job completed successfully');
  });

  worker.on('failed', (job, err) => {
    workerLogger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
      'Notification job failed',
    );
  });

  worker.on('error', err => {
    workerLogger.error({ err: err.message }, 'BullMQ notification worker encountered an error');
  });

  return worker;
}

let activeScanWorker: Worker<FoodScanJobData, FoodScanJobResult> | null = null;
let activeNotificationWorker: Worker<NotificationJobData, NotificationJobResult> | null = null;
let activeRedis: Redis | null = null;

export async function startWorkerApp() {
  workerLogger.info('Starting CAL METER background workers...');
  activeRedis = createWorkerRedisConnection();
  activeScanWorker = createFoodScanWorker(activeRedis);
  activeNotificationWorker = createNotificationWorker(activeRedis);

  workerLogger.info(
    { queues: [FOOD_SCAN_QUEUE_NAME, NOTIFICATION_QUEUE_NAME] },
    'CAL METER background workers are active and listening for jobs',
  );
  return {
    scanWorker: activeScanWorker,
    notificationWorker: activeNotificationWorker,
  };
}

export async function stopWorkerApp(): Promise<void> {
  workerLogger.info('Initiating graceful shutdown of background workers...');

  if (activeScanWorker) {
    await activeScanWorker.close();
    activeScanWorker = null;
    workerLogger.info('BullMQ scan worker closed.');
  }

  if (activeNotificationWorker) {
    await activeNotificationWorker.close();
    activeNotificationWorker = null;
    workerLogger.info('BullMQ notification worker closed.');
  }

  if (activeRedis) {
    try {
      await activeRedis.quit();
    } catch {
      activeRedis.disconnect();
    }
    activeRedis = null;
    workerLogger.info('Worker Redis connection closed.');
  }

  workerLogger.info('Worker graceful shutdown complete.');
}

// Only launch when run as entrypoint (not when imported in tests)
if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  startWorkerApp();

  const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  shutdownSignals.forEach(signal => {
    process.on(signal, async () => {
      workerLogger.info({ signal }, 'Termination signal received in worker process');
      try {
        await stopWorkerApp();
        process.exit(0);
      } catch (err) {
        workerLogger.error({ err }, 'Error during worker graceful shutdown');
        process.exit(1);
      }
    });
  });
}
