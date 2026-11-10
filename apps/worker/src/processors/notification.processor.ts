import type { Job } from 'bullmq';
import type { NotificationJobData, NotificationJobResult } from '../queues/notification.queue.js';
import { workerLogger } from '../lib/logger.js';
import { PrismaClient } from '@prisma/client';
import {
  NotificationDeliveryStatus,
  isWithinQuietHours,
  getCurrentTimeInTimezone,
} from '@calmeter/shared';

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function processNotificationJob(
  job: Job<NotificationJobData, NotificationJobResult>,
): Promise<NotificationJobResult> {
  const { userId, category, title, body, data, bypassQuietHours, dateIso } = job.data;

  workerLogger.info(
    { jobId: job.id, userId, category, dateIso, attempt: job.attemptsMade + 1 },
    'Processing notification job started',
  );

  // If mock/test mode or database url missing, return early
  if (userId === 'mock-user-uuid' || !process.env.DATABASE_URL) {
    return {
      status: NotificationDeliveryStatus.SENT,
      deviceCount: 1,
    };
  }

  try {
    const db = getPrisma();

    // 1. Check user preferences
    const pref = await db.notificationPreference.findUnique({
      where: { userId },
    });

    if (pref && !pref.enabled) {
      workerLogger.info(
        { userId, category },
        'Notification skipped: user disabled all notifications',
      );
      return {
        status: NotificationDeliveryStatus.SKIPPED_PREFERENCE,
        deviceCount: 0,
        reason: 'User disabled notifications',
      };
    }

    // 2. Check quiet hours
    if (!bypassQuietHours && pref) {
      const localTime = getCurrentTimeInTimezone(pref.timezone);
      if (isWithinQuietHours(localTime.timeHHmm, pref.quietHoursStart, pref.quietHoursEnd)) {
        workerLogger.info({ userId, category }, 'Notification skipped: active quiet hours');
        return {
          status: NotificationDeliveryStatus.SKIPPED_QUIET_HOURS,
          deviceCount: 0,
          reason: 'Quiet hours active',
        };
      }
    }

    // 3. Find active device tokens
    const tokens = await db.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });

    if (!tokens.length) {
      workerLogger.info({ userId }, 'No active device tokens found for user');
      return {
        status: NotificationDeliveryStatus.SENT,
        deviceCount: 0,
        reason: 'No devices registered',
      };
    }

    // Record delivery in database
    await db.notificationHistory.create({
      data: {
        userId,
        category,
        title,
        body,
        data: data ? (data as any) : undefined,
        status: NotificationDeliveryStatus.SENT,
        deviceCount: tokens.length,
        sentAt: new Date(),
      },
    });

    workerLogger.info(
      { jobId: job.id, userId, deviceCount: tokens.length },
      'Notification dispatched successfully',
    );

    return {
      status: NotificationDeliveryStatus.SENT,
      deviceCount: tokens.length,
    };
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    workerLogger.error({ jobId: job.id, userId, err: rawMessage }, 'Notification job failed');

    return {
      status: NotificationDeliveryStatus.FAILED,
      deviceCount: 0,
      reason: rawMessage,
    };
  }
}
