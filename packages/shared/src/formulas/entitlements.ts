import { SubscriptionTier, SubscriptionStatus, FeatureKey } from '../constants/enums.js';

export interface SubscriptionSnapshot {
  tier?: SubscriptionTier | string | null;
  status: SubscriptionStatus | string;
  expiresAt?: Date | string | null;
  autoRenewStatus?: boolean;
  billingIssueDetectedAt?: Date | string | null;
}

export interface FeaturePolicyConfig {
  freeDailyLimit?: number;
  premiumDailyLimit?: number;
  freeMaxHistoryDays?: number;
  premiumMaxHistoryDays?: number;
  requiresPremium?: boolean;
}

/**
 * Single source of truth for free vs premium feature policies.
 * These limits are configurable product policies, not permanent hardcoded values.
 */
export const DEFAULT_FEATURE_POLICIES: Record<FeatureKey, FeaturePolicyConfig> = {
  [FeatureKey.AI_PHOTO_SCAN]: {
    freeDailyLimit: 3,
    premiumDailyLimit: 50,
    requiresPremium: false,
  },
  [FeatureKey.BARCODE_SCAN]: {
    freeDailyLimit: 10,
    premiumDailyLimit: undefined, // Unlimited for premium
    requiresPremium: false,
  },
  [FeatureKey.NUTRITION_LABEL_SCAN]: {
    freeDailyLimit: 2,
    premiumDailyLimit: undefined,
    requiresPremium: false,
  },
  [FeatureKey.COACH_CHAT]: {
    freeDailyLimit: 5,
    premiumDailyLimit: undefined, // Unlimited for premium
    requiresPremium: false,
  },
  [FeatureKey.PERSONALIZED_INSIGHTS]: {
    freeDailyLimit: undefined,
    premiumDailyLimit: undefined,
    requiresPremium: false,
  },
  [FeatureKey.HISTORY_RANGE]: {
    freeMaxHistoryDays: 30,
    premiumMaxHistoryDays: undefined, // Unlimited (90D, 1Y, all-time)
    requiresPremium: false,
  },
  [FeatureKey.MEAL_RECOMMENDATIONS]: {
    freeDailyLimit: 2,
    premiumDailyLimit: undefined,
    requiresPremium: false,
  },
  [FeatureKey.ADVANCED_ANALYTICS]: {
    requiresPremium: true,
  },
};

/**
 * Deterministically evaluates effective subscription tier from trusted state.
 *
 * Invariant: A cancelled subscription remains entitled until its paid period ends (expiresAt).
 * An active subscription past its expiration date is treated as expired.
 */
export function calculateEffectiveSubscriptionTier(
  sub?: SubscriptionSnapshot | null,
  referenceDate: Date = new Date(),
): SubscriptionTier {
  if (!sub) {
    return SubscriptionTier.FREE;
  }

  const expiration = sub.expiresAt
    ? sub.expiresAt instanceof Date
      ? sub.expiresAt
      : new Date(sub.expiresAt)
    : null;

  // Active or in free trial
  if (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIAL) {
    if (expiration && expiration.getTime() < referenceDate.getTime()) {
      return SubscriptionTier.FREE;
    }
    return SubscriptionTier.PREMIUM;
  }

  // Cancelled auto-renewal: remains entitled until current billing period expires
  if (sub.status === SubscriptionStatus.CANCELED) {
    if (expiration && expiration.getTime() > referenceDate.getTime()) {
      return SubscriptionTier.PREMIUM;
    }
    return SubscriptionTier.FREE;
  }

  return SubscriptionTier.FREE;
}

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  currentUsage?: number;
  remaining?: number;
  requiresUpgrade?: boolean;
}

/**
 * Deterministically verifies feature access based on subscription tier,
 * daily usage counters, and optional parameters (e.g. requested history days).
 */
export function evaluateFeatureAccess(options: {
  tier: SubscriptionTier;
  feature: FeatureKey;
  currentUsageToday?: number;
  requestedHistoryDays?: number;
  customPolicies?: Record<FeatureKey, FeaturePolicyConfig>;
}): FeatureAccessResult {
  const { tier, feature, currentUsageToday = 0, requestedHistoryDays, customPolicies } = options;

  const policy = (customPolicies && customPolicies[feature]) || DEFAULT_FEATURE_POLICIES[feature];

  if (!policy) {
    return { allowed: true };
  }

  // 1. Premium-only feature check
  if (policy.requiresPremium && tier !== SubscriptionTier.PREMIUM) {
    return {
      allowed: false,
      reason: `${feature} is exclusive to CAL METER Premium subscribers.`,
      requiresUpgrade: true,
    };
  }

  // 2. History timeframe restriction check
  if (requestedHistoryDays !== undefined) {
    const maxDays =
      tier === SubscriptionTier.PREMIUM ? policy.premiumMaxHistoryDays : policy.freeMaxHistoryDays;

    if (maxDays !== undefined && requestedHistoryDays > maxDays) {
      return {
        allowed: false,
        reason: `Free accounts can view up to ${maxDays} days of history. Upgrade to Premium for full historical trends.`,
        limit: maxDays,
        currentUsage: requestedHistoryDays,
        requiresUpgrade: true,
      };
    }
  }

  // 3. Daily usage counter quota check
  const dailyLimit =
    tier === SubscriptionTier.PREMIUM ? policy.premiumDailyLimit : policy.freeDailyLimit;

  if (dailyLimit !== undefined) {
    const remaining = Math.max(0, dailyLimit - currentUsageToday);
    if (currentUsageToday >= dailyLimit) {
      return {
        allowed: false,
        reason: `You have reached your daily allowance of ${dailyLimit} for this feature. ${
          tier === SubscriptionTier.FREE
            ? 'Upgrade to Premium for expanded access or wait until tomorrow.'
            : 'Your allowance will reset tomorrow.'
        }`,
        limit: dailyLimit,
        currentUsage: currentUsageToday,
        remaining: 0,
        requiresUpgrade: tier === SubscriptionTier.FREE,
      };
    }

    return {
      allowed: true,
      limit: dailyLimit,
      currentUsage: currentUsageToday,
      remaining,
    };
  }

  return { allowed: true };
}
