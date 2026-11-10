import { z } from 'zod';
import {
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionStore,
  FeatureKey,
} from '@calmeter/shared';

// -------------------------------------------------------------
// ENUM SCHEMAS
// -------------------------------------------------------------

export const SubscriptionTierSchema = z.nativeEnum(SubscriptionTier);
export const SubscriptionStatusSchema = z.nativeEnum(SubscriptionStatus);
export const SubscriptionStoreSchema = z.nativeEnum(SubscriptionStore);
export const FeatureKeySchema = z.nativeEnum(FeatureKey);

// -------------------------------------------------------------
// FEATURE USAGE & ENTITLEMENT DTO SCHEMAS
// -------------------------------------------------------------

export const FeatureUsageItemSchema = z.object({
  count: z.number().int().min(0),
  limit: z.number().int().min(0).optional(),
  remaining: z.number().int().min(0).optional(),
});

export const SubscriptionStatusResponseSchema = z.object({
  tier: SubscriptionTierSchema,
  status: SubscriptionStatusSchema,
  store: SubscriptionStoreSchema,
  planId: z.string().nullable(),
  productId: z.string().nullable(),
  entitlements: z.array(z.string()),
  expiresAt: z.string().datetime().nullable(),
  autoRenewStatus: z.boolean(),
  isSandbox: z.boolean(),
  billingIssue: z.boolean(),
  cancelReason: z.string().nullable(),
  isActive: z.boolean().default(false),
  isCanceled: z.boolean().default(false),
  cancelAtPeriodEnd: z.boolean().default(false),
  dailyUsage: z.record(z.string(), FeatureUsageItemSchema).optional(),
  quotas: z.record(z.string(), z.any()).optional(),
});

export const SyncSubscriptionRequestSchema = z.object({
  appUserId: z.string().min(1).max(128).optional(),
});

export const FeatureCheckQuerySchema = z.object({
  feature: FeatureKeySchema,
  historyDays: z.coerce.number().int().positive().optional(),
  requestedDays: z.coerce.number().int().positive().optional(),
});

export const FeatureAccessResponseSchema = z.object({
  allowed: z.boolean(),
  canAccess: z.boolean().optional(),
  feature: FeatureKeySchema,
  tier: SubscriptionTierSchema,
  limit: z.number().int().nullable().optional(),
  dailyLimit: z.number().int().nullable().optional(),
  currentUsage: z.number().int().optional(),
  usedToday: z.number().int().optional(),
  remaining: z.number().int().nullable().optional(),
  remainingToday: z.number().int().nullable().optional(),
  reason: z.string().optional(),
  requiresUpgrade: z.boolean().optional(),
});

export const FeatureLimitExceededErrorSchema = z.object({
  code: z.literal('FEATURE_LIMIT_EXCEEDED'),
  message: z.string(),
  feature: FeatureKeySchema,
  limit: z.number().int(),
  currentUsage: z.number().int(),
  upgradeUrl: z.string().default('/paywall'),
});

// -------------------------------------------------------------
// REVENUECAT WEBHOOK EVENT SCHEMAS
// -------------------------------------------------------------

export const RevenueCatEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().min(1),
    original_app_user_id: z.string().optional(),
    product_id: z.string().optional(),
    entitlement_id: z.string().nullish(),
    entitlement_ids: z.array(z.string()).nullish(),
    period_type: z.string().optional(),
    purchased_at_ms: z.number().optional(),
    expiration_at_ms: z.number().nullish(),
    environment: z.string().optional(),
    store: z.string().optional(),
    cancel_reason: z.string().nullish(),
    event_timestamp_ms: z.number(),
    aliases: z.array(z.string()).optional(),
  })
  .passthrough();

export const RevenueCatWebhookPayloadSchema = z
  .object({
    api_version: z.string().optional(),
    event: RevenueCatEventSchema,
  })
  .passthrough();

// -------------------------------------------------------------
// TYPE EXPORTS
// -------------------------------------------------------------

export type SubscriptionStatusResponseDto = z.infer<typeof SubscriptionStatusResponseSchema>;
export type SyncSubscriptionRequestDto = z.infer<typeof SyncSubscriptionRequestSchema>;
export type FeatureCheckQueryDto = z.infer<typeof FeatureCheckQuerySchema>;
export type FeatureAccessResponseDto = z.infer<typeof FeatureAccessResponseSchema>;
export type FeatureLimitExceededErrorDto = z.infer<typeof FeatureLimitExceededErrorSchema>;
export type RevenueCatWebhookPayloadDto = z.infer<typeof RevenueCatWebhookPayloadSchema>;
export type RevenueCatEventDto = z.infer<typeof RevenueCatEventSchema>;
