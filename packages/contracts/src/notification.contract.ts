import { z } from 'zod';
import { DevicePlatform, NotificationCategory, NotificationDeliveryStatus } from '@calmeter/shared';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const RegisterDeviceTokenSchema = z.object({
  token: z.string().min(10).max(512),
  platform: z.nativeEnum(DevicePlatform).default(DevicePlatform.ANDROID),
  deviceModel: z.string().max(100).optional().nullable(),
  osVersion: z.string().max(50).optional().nullable(),
  appVersion: z.string().max(50).optional().nullable(),
});

export type RegisterDeviceTokenInput = z.infer<typeof RegisterDeviceTokenSchema>;

export const DeactivateDeviceTokenSchema = z.object({
  token: z.string().min(10).max(512),
});

export type DeactivateDeviceTokenInput = z.infer<typeof DeactivateDeviceTokenSchema>;

export const NotificationPreferenceSchema = z.object({
  enabled: z.boolean().default(true),
  mealReminders: z.boolean().default(true),
  breakfastReminder: z.boolean().default(true),
  lunchReminder: z.boolean().default(true),
  dinnerReminder: z.boolean().default(true),
  waterReminders: z.boolean().default(true),
  dailySummary: z.boolean().default(true),
  weeklySummary: z.boolean().default(true),
  weightReminders: z.boolean().default(true),
  coachInsights: z.boolean().default(true),
  subscriptionUpdates: z.boolean().default(true),

  breakfastTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('08:30'),
  lunchTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('13:00'),
  dinnerTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('20:00'),
  dailySummaryTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('21:30'),
  weightReminderTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('08:00'),
  weeklySummaryDay: z.number().int().min(0).max(6).default(0), // 0 = Sunday
  waterIntervalHours: z.number().int().min(1).max(12).default(2),
  waterStartTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('09:00'),
  waterEndTime: z.string().regex(TIME_REGEX, 'Must be valid HH:mm').default('21:00'),

  quietHoursStart: z
    .string()
    .regex(TIME_REGEX, 'Must be valid HH:mm')
    .optional()
    .nullable()
    .default('22:00'),
  quietHoursEnd: z
    .string()
    .regex(TIME_REGEX, 'Must be valid HH:mm')
    .optional()
    .nullable()
    .default('07:00'),

  timezone: z.string().default('Asia/Kolkata'),
});

export type NotificationPreferenceData = z.infer<typeof NotificationPreferenceSchema>;

export const UpdateNotificationPreferenceSchema = NotificationPreferenceSchema.partial();

export type UpdateNotificationPreferenceInput = z.infer<typeof UpdateNotificationPreferenceSchema>;

export const NotificationHistoryItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  category: z.nativeEnum(NotificationCategory),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).optional().nullable(),
  status: z.nativeEnum(NotificationDeliveryStatus),
  deviceCount: z.number().int().nonnegative(),
  failureReason: z.string().optional().nullable(),
  sentAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
});

export type NotificationHistoryItem = z.infer<typeof NotificationHistoryItemSchema>;

export const NotificationHistoryListResponseSchema = z.object({
  notifications: z.array(NotificationHistoryItemSchema),
  total: z.number().int().nonnegative(),
});

export type NotificationHistoryListResponse = z.infer<typeof NotificationHistoryListResponseSchema>;

export const SendTestNotificationSchema = z.object({
  category: z
    .nativeEnum(NotificationCategory)
    .default(NotificationCategory.MEAL_REMINDER_BREAKFAST),
  title: z.string().max(200).optional(),
  body: z.string().max(1000).optional(),
});

export type SendTestNotificationInput = z.infer<typeof SendTestNotificationSchema>;
