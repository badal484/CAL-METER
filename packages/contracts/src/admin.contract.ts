import { z } from 'zod';
import {
  AdminRole,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketCategory,
  NotificationCampaignStatus,
  NotificationCategory,
} from '@calmeter/shared';

export const AdminUserDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(AdminRole),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type AdminUserDto = z.infer<typeof AdminUserDtoSchema>;

export const ProvisionAdminInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(AdminRole).default(AdminRole.SUPPORT_ADMIN),
});

export type ProvisionAdminInput = z.infer<typeof ProvisionAdminInputSchema>;

export const UpdateAdminRoleInputSchema = z.object({
  role: z.nativeEnum(AdminRole),
});

export type UpdateAdminRoleInput = z.infer<typeof UpdateAdminRoleInputSchema>;

export const AdminAuditLogDtoSchema = z.object({
  id: z.string().uuid(),
  adminId: z.string().uuid(),
  adminEmail: z.string().optional(),
  adminName: z.string().optional(),
  action: z.string(),
  targetResource: z.string(),
  targetId: z.string().nullable().optional(),
  details: z.record(z.unknown()).nullable().optional(),
  reason: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  status: z.string(),
  createdAt: z.string().datetime(),
});

export type AdminAuditLogDto = z.infer<typeof AdminAuditLogDtoSchema>;

export const AdminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'suspended']).default('all'),
  tier: z.enum(['all', 'free', 'premium']).default('all'),
});

export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export const SuspendUserInputSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type SuspendUserInput = z.infer<typeof SuspendUserInputSchema>;

export const CreateSupportTicketInputSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  userEmail: z.string().email().optional().nullable(),
  category: z.nativeEnum(SupportTicketCategory).default(SupportTicketCategory.GENERAL_INQUIRY),
  priority: z.nativeEnum(SupportTicketPriority).default(SupportTicketPriority.MEDIUM),
  subject: z.string().min(3).max(200),
  message: z.string().min(5).max(5000),
});

export type CreateSupportTicketInput = z.infer<typeof CreateSupportTicketInputSchema>;

export const UpdateSupportTicketInputSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  assignedAdminId: z.string().uuid().optional().nullable(),
  resolutionNotes: z.string().max(2000).optional().nullable(),
});

export type UpdateSupportTicketInput = z.infer<typeof UpdateSupportTicketInputSchema>;

export const AddTicketNoteInputSchema = z.object({
  note: z.string().min(1).max(2000),
});

export type AddTicketNoteInput = z.infer<typeof AddTicketNoteInputSchema>;

export const CreateNotificationCampaignInputSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(5).max(1000),
  category: z.nativeEnum(NotificationCategory).default(NotificationCategory.DAILY_SUMMARY),
  deepLink: z.string().max(255).optional().nullable(),
  targetAudience: z.enum(['ALL', 'FREE_TIER', 'PREMIUM_TIER']).default('ALL'),
  status: z.nativeEnum(NotificationCampaignStatus).default(NotificationCampaignStatus.DRAFT),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type CreateNotificationCampaignInput = z.infer<typeof CreateNotificationCampaignInputSchema>;

export const CreateRecipeInputSchema = z.object({
  foodItemId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  cuisine: z.string().default('INDIAN_NORTH'),
  dietaryTags: z.array(z.string()).default([]),
  servings: z.number().int().positive().default(2),
  prepTimeMinutes: z.number().int().nonnegative().default(15),
  cookTimeMinutes: z.number().int().nonnegative().default(20),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
  instructions: z.array(z.string()).min(1),
  ingredients: z
    .array(
      z.object({
        name: z.string(),
        amount: z.string(),
        calories: z.number().optional(),
      }),
    )
    .min(1),
  caloriesPerServing: z.number().nonnegative().optional().nullable(),
  proteinPerServing: z.number().nonnegative().optional().nullable(),
  carbsPerServing: z.number().nonnegative().optional().nullable(),
  fatPerServing: z.number().nonnegative().optional().nullable(),
  fiberPerServing: z.number().nonnegative().optional().nullable(),
  isPublished: z.boolean().default(true),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;

export const UpdateRecipeInputSchema = CreateRecipeInputSchema.partial();

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInputSchema>;

export const AdminDashboardOverviewSchema = z.object({
  business: z.object({
    totalUsers: z.number().int().nonnegative(),
    dailyActiveUsers: z.number().int().nonnegative(),
    weeklyActiveUsers: z.number().int().nonnegative(),
    monthlyActiveUsers: z.number().int().nonnegative(),
    newRegistrationsToday: z.number().int().nonnegative(),
    freeUsers: z.number().int().nonnegative(),
    premiumSubscribers: z.number().int().nonnegative(),
    activeSubscriptions: z.number().int().nonnegative(),
    conversionRatePercent: z.number().nonnegative(),
    mrrEstimateUsd: z.number().nonnegative(),
    churnRatePercent: z.number().nonnegative(),
  }),
  product: z.object({
    dailyDiaryEntries: z.number().int().nonnegative(),
    photoScansTotal: z.number().int().nonnegative(),
    barcodeScansTotal: z.number().int().nonnegative(),
    coachMessagesTotal: z.number().int().nonnegative(),
    mealRecommendationsTotal: z.number().int().nonnegative(),
  }),
  operational: z.object({
    apiUptimeSeconds: z.number().nonnegative(),
    avgLatencyMs: z.number().nonnegative(),
    p95LatencyMs: z.number().nonnegative(),
    errorRatePercent: z.number().nonnegative(),
    databaseStatus: z.string(),
    redisStatus: z.string(),
    workerActiveJobs: z.number().int().nonnegative(),
    workerFailedJobs: z.number().int().nonnegative(),
    workerQueueDepth: z.number().int().nonnegative(),
    aiTotalTokens: z.number().int().nonnegative(),
    aiEstimatedCostUsd: z.number().nonnegative(),
    aiFailureCount: z.number().int().nonnegative(),
  }),
  generatedAt: z.string().datetime(),
});

export type AdminDashboardOverview = z.infer<typeof AdminDashboardOverviewSchema>;
