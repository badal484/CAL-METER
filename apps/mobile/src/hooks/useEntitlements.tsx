import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SubscriptionTier, FeatureKey, DEFAULT_FEATURE_POLICIES } from '@calmeter/shared';
import type { SubscriptionStatusResponseDto, FeatureAccessResponseDto } from '@calmeter/contracts';
import { SubscriptionApiClient } from '../services/subscriptionApi';

export interface EntitlementsContextValue {
  tier: SubscriptionTier;
  isPremium: boolean;
  isActive: boolean;
  isCanceled: boolean;
  cancelAtPeriodEnd: boolean;
  expiresAt: string | null;
  dailyUsage: Record<string, { count: number; limit?: number; remaining?: number }>;
  loading: boolean;
  canAccess: (feature: FeatureKey, historyDays?: number) => boolean;
  getRemainingQuota: (feature: FeatureKey) => number | null;
  checkFeatureAccess: (
    feature: FeatureKey,
    historyDays?: number,
  ) => Promise<FeatureAccessResponseDto>;
  refresh: () => Promise<void>;
  status: SubscriptionStatusResponseDto | null;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export interface EntitlementsProviderProps {
  children: React.ReactNode;
  subscriptionClient?: SubscriptionApiClient;
  initialStatus?: SubscriptionStatusResponseDto;
}

export const EntitlementsProvider: React.FC<EntitlementsProviderProps> = ({
  children,
  subscriptionClient = new SubscriptionApiClient(),
  initialStatus,
}) => {
  const [status, setStatus] = useState<SubscriptionStatusResponseDto | null>(initialStatus || null);
  const [loading, setLoading] = useState<boolean>(!initialStatus);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const latest = await subscriptionClient.getSubscriptionStatus();
      setStatus(latest);
    } catch (err) {
      console.warn('[useEntitlements] Failed to fetch subscription status:', err);
    } finally {
      setLoading(false);
    }
  }, [subscriptionClient]);

  useEffect(() => {
    if (!initialStatus) {
      refresh();
    }
  }, [initialStatus, refresh]);

  const tier = (status?.tier as SubscriptionTier) || SubscriptionTier.FREE;
  const isPremium = tier === SubscriptionTier.PREMIUM;
  const isActive = status?.isActive ?? isPremium;
  const isCanceled = status?.isCanceled ?? false;
  const cancelAtPeriodEnd = status?.cancelAtPeriodEnd ?? false;
  const expiresAt = status?.expiresAt ?? null;
  const dailyUsage = (status?.dailyUsage as any) || {};

  const canAccess = useCallback(
    (feature: FeatureKey, historyDays?: number): boolean => {
      if (isPremium) {
        return true;
      }

      const policy = DEFAULT_FEATURE_POLICIES[feature];
      if (!policy) return true;

      // Requires premium exclusively
      if (policy.requiresPremium) {
        return false;
      }

      // History timeframe check
      if (historyDays !== undefined && policy.freeMaxHistoryDays !== undefined) {
        if (historyDays > policy.freeMaxHistoryDays) {
          return false;
        }
      }

      // Daily quota check
      if (policy.freeDailyLimit !== undefined) {
        const usage = dailyUsage[feature]?.count || 0;
        if (usage >= policy.freeDailyLimit) {
          return false;
        }
      }

      return true;
    },
    [isPremium, dailyUsage],
  );

  const getRemainingQuota = useCallback(
    (feature: FeatureKey): number | null => {
      if (isPremium) {
        return null; // Unlimited for premium
      }
      const policy = DEFAULT_FEATURE_POLICIES[feature];
      if (!policy || policy.freeDailyLimit === undefined) {
        return null;
      }
      const used = dailyUsage[feature]?.count || 0;
      return Math.max(0, policy.freeDailyLimit - used);
    },
    [isPremium, dailyUsage],
  );

  const checkFeatureAccess = useCallback(
    async (feature: FeatureKey, historyDays?: number): Promise<FeatureAccessResponseDto> => {
      return subscriptionClient.checkFeatureAccess(feature, historyDays);
    },
    [subscriptionClient],
  );

  const value: EntitlementsContextValue = {
    tier,
    isPremium,
    isActive,
    isCanceled,
    cancelAtPeriodEnd,
    expiresAt,
    dailyUsage,
    loading,
    canAccess,
    getRemainingQuota,
    checkFeatureAccess,
    refresh,
    status,
  };

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
};

export function useEntitlements(): EntitlementsContextValue {
  const context = useContext(EntitlementsContext);
  if (!context) {
    // Provide safe fallback defaults if hook is used outside Provider
    return {
      tier: SubscriptionTier.FREE,
      isPremium: false,
      isActive: false,
      isCanceled: false,
      cancelAtPeriodEnd: false,
      expiresAt: null,
      dailyUsage: {},
      loading: false,
      canAccess: () => true,
      getRemainingQuota: () => null,
      checkFeatureAccess: async () => ({
        allowed: true,
        feature: FeatureKey.AI_PHOTO_SCAN,
        tier: SubscriptionTier.FREE,
      }),
      refresh: async () => {},
      status: null,
    };
  }
  return context;
}
