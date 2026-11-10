import type { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';
import {
  NotificationCategory,
  NotificationDeliveryStatus,
  isWithinQuietHours,
  getCurrentTimeInTimezone,
} from '@calmeter/shared';
import { DeviceTokenService } from './deviceToken.service.js';
import { NotificationPreferenceService } from './notificationPreference.service.js';

export interface PushSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export interface IPushNotificationProvider {
  sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushSendResult>;
}

export class MockPushNotificationProvider implements IPushNotificationProvider {
  public dispatched: Array<{
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }> = [];

  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushSendResult> {
    this.dispatched.push({ tokens, title, body, data });
    return {
      successCount: tokens.length,
      failureCount: 0,
      invalidTokens: [],
    };
  }
}

export class FcmPushNotificationProvider implements IPushNotificationProvider {
  constructor(private app?: admin.app.App) {}

  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushSendResult> {
    if (!tokens.length) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const messaging = this.app ? this.app.messaging() : admin.messaging();

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          const t = tokens[idx];
          if (t) invalidTokens.push(t);
        }
      }
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  }
}

export interface DispatchNotificationParams {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, string>;
  bypassQuietHours?: boolean;
}

export interface DispatchNotificationResult {
  status: NotificationDeliveryStatus;
  historyId?: string;
  deviceCount: number;
  reason?: string;
}

export class NotificationDispatcherService {
  private deviceTokenService: DeviceTokenService;
  private preferenceService: NotificationPreferenceService;

  constructor(
    private prisma: PrismaClient,
    private pushProvider: IPushNotificationProvider = new MockPushNotificationProvider(),
  ) {
    this.deviceTokenService = new DeviceTokenService(prisma);
    this.preferenceService = new NotificationPreferenceService(prisma);
  }

  setPushProvider(provider: IPushNotificationProvider) {
    this.pushProvider = provider;
  }

  /**
   * Evaluates user preferences and quiet hours, then delivers push notification via FCM/provider.
   */
  async dispatchNotification(
    params: DispatchNotificationParams,
  ): Promise<DispatchNotificationResult> {
    const { userId, category, title, body, data, bypassQuietHours = false } = params;

    const pref = await this.preferenceService.getPreferences(userId);

    // 1. Verify global notifications enabled
    if (!pref.enabled && category !== NotificationCategory.ACCOUNT_SECURITY) {
      await this.recordHistory({
        userId,
        category,
        title,
        body,
        data,
        status: NotificationDeliveryStatus.SKIPPED_PREFERENCE,
        deviceCount: 0,
        failureReason: 'User disabled notifications in preferences.',
      });
      return {
        status: NotificationDeliveryStatus.SKIPPED_PREFERENCE,
        deviceCount: 0,
        reason: 'User disabled notifications',
      };
    }

    // 2. Check category-level preferences
    let categoryEnabled = true;
    switch (category) {
      case NotificationCategory.MEAL_REMINDER_BREAKFAST:
        categoryEnabled = pref.mealReminders && pref.breakfastReminder;
        break;
      case NotificationCategory.MEAL_REMINDER_LUNCH:
        categoryEnabled = pref.mealReminders && pref.lunchReminder;
        break;
      case NotificationCategory.MEAL_REMINDER_DINNER:
        categoryEnabled = pref.mealReminders && pref.dinnerReminder;
        break;
      case NotificationCategory.WATER_REMINDER:
        categoryEnabled = pref.waterReminders;
        break;
      case NotificationCategory.DAILY_SUMMARY:
        categoryEnabled = pref.dailySummary;
        break;
      case NotificationCategory.WEEKLY_SUMMARY:
        categoryEnabled = pref.weeklySummary;
        break;
      case NotificationCategory.WEIGHT_REMINDER:
        categoryEnabled = pref.weightReminders;
        break;
      case NotificationCategory.COACH_INSIGHT:
        categoryEnabled = pref.coachInsights;
        break;
      case NotificationCategory.SUBSCRIPTION_LIFECYCLE:
        categoryEnabled = pref.subscriptionUpdates;
        break;
      case NotificationCategory.ACCOUNT_SECURITY:
        categoryEnabled = true;
        break;
    }

    if (!categoryEnabled) {
      await this.recordHistory({
        userId,
        category,
        title,
        body,
        data,
        status: NotificationDeliveryStatus.SKIPPED_PREFERENCE,
        deviceCount: 0,
        failureReason: `User disabled category ${category}`,
      });
      return {
        status: NotificationDeliveryStatus.SKIPPED_PREFERENCE,
        deviceCount: 0,
        reason: `Disabled category: ${category}`,
      };
    }

    // 3. Check quiet hours (Account security alerts bypass quiet hours)
    if (!bypassQuietHours && category !== NotificationCategory.ACCOUNT_SECURITY) {
      const localTime = getCurrentTimeInTimezone(pref.timezone);
      if (isWithinQuietHours(localTime.timeHHmm, pref.quietHoursStart, pref.quietHoursEnd)) {
        await this.recordHistory({
          userId,
          category,
          title,
          body,
          data,
          status: NotificationDeliveryStatus.SKIPPED_QUIET_HOURS,
          deviceCount: 0,
          failureReason: `Quiet hours active (${pref.quietHoursStart} to ${pref.quietHoursEnd} in ${pref.timezone})`,
        });
        return {
          status: NotificationDeliveryStatus.SKIPPED_QUIET_HOURS,
          deviceCount: 0,
          reason: 'Quiet hours active',
        };
      }
    }

    // 4. Retrieve active device tokens
    const devices = await this.deviceTokenService.getActiveTokensForUser(userId);
    if (!devices.length) {
      const history = await this.recordHistory({
        userId,
        category,
        title,
        body,
        data,
        status: NotificationDeliveryStatus.SENT,
        deviceCount: 0,
        failureReason: 'No registered active devices found',
      });
      return {
        status: NotificationDeliveryStatus.SENT,
        historyId: history.id,
        deviceCount: 0,
        reason: 'No devices registered',
      };
    }

    const tokens = devices.map(d => d.token);

    // 5. Send push notification
    try {
      const sendResult = await this.pushProvider.sendMulticast(tokens, title, body, data);

      // Invalidate stale/unregistered tokens
      if (sendResult.invalidTokens.length > 0) {
        await this.deviceTokenService.markTokensInactive(sendResult.invalidTokens);
      }

      const deliveryStatus =
        sendResult.successCount > 0
          ? NotificationDeliveryStatus.SENT
          : NotificationDeliveryStatus.FAILED;

      const history = await this.recordHistory({
        userId,
        category,
        title,
        body,
        data,
        status: deliveryStatus,
        deviceCount: sendResult.successCount,
        sentAt: deliveryStatus === NotificationDeliveryStatus.SENT ? new Date() : undefined,
        failureReason:
          sendResult.failureCount > 0
            ? `${sendResult.failureCount} devices failed delivery`
            : undefined,
      });

      return {
        status: deliveryStatus,
        historyId: history.id,
        deviceCount: sendResult.successCount,
      };
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const history = await this.recordHistory({
        userId,
        category,
        title,
        body,
        data,
        status: NotificationDeliveryStatus.FAILED,
        deviceCount: 0,
        failureReason: rawMessage,
      });

      return {
        status: NotificationDeliveryStatus.FAILED,
        historyId: history.id,
        deviceCount: 0,
        reason: rawMessage,
      };
    }
  }

  private async recordHistory(params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    status: NotificationDeliveryStatus;
    deviceCount: number;
    failureReason?: string;
    sentAt?: Date;
  }) {
    return this.prisma.notificationHistory.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title,
        body: params.body,
        data: params.data ? (params.data as any) : undefined,
        status: params.status,
        deviceCount: params.deviceCount,
        failureReason: params.failureReason,
        sentAt: params.sentAt,
      },
    });
  }

  /**
   * Retrieves notification history for a user.
   */
  async getHistory(userId: string, limit: number = 50) {
    return this.prisma.notificationHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
