import type { PrismaClient } from '@prisma/client';
import type { UpdateNotificationPreferenceInput } from '@calmeter/contracts';

const DEFAULT_PREFERENCES = {
  enabled: true,
  mealReminders: true,
  breakfastReminder: true,
  lunchReminder: true,
  dinnerReminder: true,
  waterReminders: true,
  dailySummary: true,
  weeklySummary: true,
  weightReminders: true,
  coachInsights: true,
  subscriptionUpdates: true,
  breakfastTime: '08:30',
  lunchTime: '13:00',
  dinnerTime: '20:00',
  dailySummaryTime: '21:30',
  weightReminderTime: '08:00',
  weeklySummaryDay: 0,
  waterIntervalHours: 2,
  waterStartTime: '09:00',
  waterEndTime: '21:00',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'Asia/Kolkata',
};

export class NotificationPreferenceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Retrieves notification preferences for a user, provisioning defaults if not present.
   */
  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.notificationPreference.create({
      data: {
        userId,
        ...DEFAULT_PREFERENCES,
      },
    });
  }

  /**
   * Updates notification preferences for a user.
   */
  async updatePreferences(userId: string, input: UpdateNotificationPreferenceInput) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...DEFAULT_PREFERENCES,
        ...input,
      },
      update: {
        ...input,
      },
    });
  }
}
