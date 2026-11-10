import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import {
  FeatureKey,
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionStore,
  calculateEffectiveSubscriptionTier,
  evaluateFeatureAccess,
  DEFAULT_FEATURE_POLICIES,
  formatDateToIso,
  parseIsoDate,
} from '@calmeter/shared';
import type { SubscriptionStatusResponseDto, FeatureAccessResponseDto } from '@calmeter/contracts';
import { FeatureLimitExceededError } from '../lib/errors.js';

export interface SubscriptionServiceOptions {
  prisma?: PrismaClient;
}

export class SubscriptionService {
  private prisma: PrismaClient;

  constructor(options?: SubscriptionServiceOptions) {
    this.prisma = options?.prisma || getPrismaClient();
  }

  /**
   * Retrieves authoritative subscription and entitlement status from database.
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponseDto> {
    const todayStr = formatDateToIso(new Date());
    const todayDate = parseIsoDate(todayStr);

    const [subscription, usageRecords] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { userId },
      }),
      this.prisma.userFeatureUsage.findMany({
        where: { userId, date: todayDate },
      }),
    ]);

    const effectiveTier = calculateEffectiveSubscriptionTier(subscription);

    // Build usage map for all features
    const usageMap: Record<string, { count: number; limit?: number; remaining?: number }> = {};
    const usageByFeature = new Map<string, number>();
    for (const record of usageRecords) {
      usageByFeature.set(record.feature, record.count);
    }

    for (const feature of Object.values(FeatureKey)) {
      const policy = DEFAULT_FEATURE_POLICIES[feature];
      const count = usageByFeature.get(feature) || 0;
      const limit =
        effectiveTier === SubscriptionTier.PREMIUM
          ? policy?.premiumDailyLimit
          : policy?.freeDailyLimit;
      const remaining = limit !== undefined ? Math.max(0, limit - count) : undefined;

      usageMap[feature] = {
        count,
        limit,
        remaining,
      };
    }

    const entitlements = effectiveTier === SubscriptionTier.PREMIUM ? ['premium_access'] : [];
    const statusVal = (subscription?.status as SubscriptionStatus) || SubscriptionStatus.FREE;
    const isActive = effectiveTier === SubscriptionTier.PREMIUM;
    const isCanceled = statusVal === SubscriptionStatus.CANCELED;
    const cancelAtPeriodEnd = isCanceled && subscription?.autoRenewStatus === false;

    // Build quotas structure compatible with client schemas
    const quotasMap: Record<
      string,
      { dailyLimit?: number | null; isAllowed: boolean; freeMaxHistoryDays?: number }
    > = {};
    for (const feature of Object.values(FeatureKey)) {
      const policy = DEFAULT_FEATURE_POLICIES[feature];
      quotasMap[feature] = {
        dailyLimit:
          effectiveTier === SubscriptionTier.PREMIUM
            ? (policy.premiumDailyLimit ?? null)
            : (policy.freeDailyLimit ?? null),
        isAllowed: policy.requiresPremium ? effectiveTier === SubscriptionTier.PREMIUM : true,
        freeMaxHistoryDays: policy.freeMaxHistoryDays,
      };
    }

    return {
      tier: effectiveTier,
      status: statusVal,
      store: (subscription?.store as SubscriptionStore) || SubscriptionStore.UNKNOWN,
      planId: subscription?.planId || null,
      productId: subscription?.productId || null,
      entitlements,
      expiresAt: subscription?.expiresAt ? subscription.expiresAt.toISOString() : null,
      autoRenewStatus: subscription?.autoRenewStatus ?? false,
      isSandbox: subscription?.isSandbox ?? false,
      billingIssue: Boolean(subscription?.billingIssueDetectedAt),
      cancelReason: subscription?.cancelReason || null,
      isActive,
      isCanceled,
      cancelAtPeriodEnd,
      dailyUsage: usageMap,
      quotas: quotasMap,
    };
  }

  /**
   * Resolves current effective subscription tier for user.
   */
  async getEffectiveTier(userId: string): Promise<SubscriptionTier> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: {
        tier: true,
        status: true,
        expiresAt: true,
        autoRenewStatus: true,
      },
    });

    return calculateEffectiveSubscriptionTier(subscription);
  }

  /**
   * Pre-flight checks whether user can access a given feature.
   */
  async checkFeatureAccess(
    userId: string,
    feature: FeatureKey,
    requestedHistoryDays?: number,
  ): Promise<FeatureAccessResponseDto> {
    const tier = await this.getEffectiveTier(userId);
    const todayStr = formatDateToIso(new Date());
    const todayDate = parseIsoDate(todayStr);

    let currentUsageToday = 0;
    const policy = DEFAULT_FEATURE_POLICIES[feature];
    const dailyLimit =
      tier === SubscriptionTier.PREMIUM ? policy?.premiumDailyLimit : policy?.freeDailyLimit;

    if (dailyLimit !== undefined) {
      const usageRecord = await this.prisma.userFeatureUsage.findUnique({
        where: {
          userId_feature_date: {
            userId,
            feature,
            date: todayDate,
          },
        },
      });
      currentUsageToday = usageRecord?.count || 0;
    }

    const evaluation = evaluateFeatureAccess({
      tier,
      feature,
      currentUsageToday,
      requestedHistoryDays,
    });

    return {
      allowed: evaluation.allowed,
      canAccess: evaluation.allowed,
      feature,
      tier,
      limit: evaluation.limit ?? null,
      dailyLimit: evaluation.limit ?? null,
      currentUsage: currentUsageToday,
      usedToday: currentUsageToday,
      remaining: evaluation.remaining ?? null,
      remainingToday: evaluation.remaining ?? null,
      reason: evaluation.reason,
      requiresUpgrade: evaluation.requiresUpgrade,
    };
  }

  /**
   * Enforces feature access, throwing a 403 FeatureLimitExceededError if denied.
   */
  async assertFeatureAccess(
    userId: string,
    feature: FeatureKey,
    requestedHistoryDays?: number,
  ): Promise<void> {
    const access = await this.checkFeatureAccess(userId, feature, requestedHistoryDays);
    if (!access.allowed) {
      throw new FeatureLimitExceededError(
        access.reason || `Access to ${feature} is restricted for your current plan.`,
        feature,
        access.limit ?? undefined,
        access.currentUsage,
      );
    }
  }

  /**
   * Atomically increments the daily quota usage counter for a feature.
   * Safe for concurrent requests using PostgreSQL UPSERT.
   */
  async incrementFeatureUsage(
    userId: string,
    feature: FeatureKey,
    dateOverride?: Date | string,
  ): Promise<number> {
    const todayDate = dateOverride
      ? dateOverride instanceof Date
        ? dateOverride
        : parseIsoDate(dateOverride)
      : parseIsoDate(formatDateToIso(new Date()));

    const record = await this.prisma.userFeatureUsage.upsert({
      where: {
        userId_feature_date: {
          userId,
          feature,
          date: todayDate,
        },
      },
      create: {
        userId,
        feature,
        date: todayDate,
        count: 1,
      },
      update: {
        count: {
          increment: 1,
        },
      },
    });

    return record.count;
  }

  /**
   * Client-triggered subscription synchronization.
   * Updates or seeds a Subscription row if none exists, keeping backend in sync.
   */
  async syncSubscription(
    userId: string,
    appUserId?: string,
  ): Promise<SubscriptionStatusResponseDto> {
    const effectiveAppUserId = appUserId || userId;

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        revenueCatAppUserId: effectiveAppUserId,
        status: SubscriptionStatus.FREE,
        tier: SubscriptionTier.FREE,
      },
      update: {
        revenueCatAppUserId: effectiveAppUserId,
      },
    });

    return this.getSubscriptionStatus(userId);
  }
}
