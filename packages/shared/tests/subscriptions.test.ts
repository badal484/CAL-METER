import { describe, it, expect } from 'vitest';
import {
  SubscriptionTier,
  SubscriptionStatus,
  FeatureKey,
  calculateEffectiveSubscriptionTier,
  evaluateFeatureAccess,
} from '../src/index.js';

describe('Subscription & Entitlements Formulas (Part 12)', () => {
  const baseDate = new Date('2026-11-10T12:00:00.000Z');

  describe('calculateEffectiveSubscriptionTier', () => {
    it('returns FREE when subscription is null or undefined', () => {
      expect(calculateEffectiveSubscriptionTier(null, baseDate)).toBe(SubscriptionTier.FREE);
      expect(calculateEffectiveSubscriptionTier(undefined, baseDate)).toBe(SubscriptionTier.FREE);
    });

    it('returns PREMIUM for ACTIVE status with future expiration', () => {
      const sub = {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date('2026-12-10T12:00:00.000Z'),
        autoRenewStatus: true,
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.PREMIUM);
    });

    it('returns PREMIUM for ACTIVE status without explicit expiration', () => {
      const sub = {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: null,
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.PREMIUM);
    });

    it('returns FREE for ACTIVE status if past expiration date', () => {
      const sub = {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date('2026-11-09T12:00:00.000Z'),
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.FREE);
    });

    it('returns PREMIUM for TRIAL status before expiration', () => {
      const sub = {
        status: SubscriptionStatus.TRIAL,
        expiresAt: new Date('2026-11-17T12:00:00.000Z'),
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.PREMIUM);
    });

    it('preserves PREMIUM for CANCELED subscription while still within paid period', () => {
      const sub = {
        status: SubscriptionStatus.CANCELED,
        expiresAt: new Date('2026-11-20T12:00:00.000Z'),
        autoRenewStatus: false,
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.PREMIUM);
    });

    it('returns FREE for CANCELED subscription after paid period has expired', () => {
      const sub = {
        status: SubscriptionStatus.CANCELED,
        expiresAt: new Date('2026-11-05T12:00:00.000Z'),
        autoRenewStatus: false,
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.FREE);
    });

    it('returns FREE for EXPIRED status', () => {
      const sub = {
        status: SubscriptionStatus.EXPIRED,
        expiresAt: new Date('2026-11-01T12:00:00.000Z'),
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.FREE);
    });

    it('returns FREE for PAST_DUE status without active grace', () => {
      const sub = {
        status: SubscriptionStatus.PAST_DUE,
        expiresAt: new Date('2026-11-09T12:00:00.000Z'),
      };
      expect(calculateEffectiveSubscriptionTier(sub, baseDate)).toBe(SubscriptionTier.FREE);
    });
  });

  describe('evaluateFeatureAccess', () => {
    it('allows Free user within daily AI photo scan quota', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.FREE,
        feature: FeatureKey.AI_PHOTO_SCAN,
        currentUsageToday: 2,
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(1);
    });

    it('rejects Free user who has reached daily AI photo scan quota', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.FREE,
        feature: FeatureKey.AI_PHOTO_SCAN,
        currentUsageToday: 3,
      });

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(0);
      expect(result.requiresUpgrade).toBe(true);
      expect(result.reason).toContain('daily allowance of 3');
    });

    it('grants expanded quota for Premium subscriber', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.PREMIUM,
        feature: FeatureKey.AI_PHOTO_SCAN,
        currentUsageToday: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(45);
    });

    it('allows unlimited barcode scans for Premium subscriber', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.PREMIUM,
        feature: FeatureKey.BARCODE_SCAN,
        currentUsageToday: 100,
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBeUndefined();
    });

    it('restricts Free user to 30 days of historical progress', () => {
      const allow30 = evaluateFeatureAccess({
        tier: SubscriptionTier.FREE,
        feature: FeatureKey.HISTORY_RANGE,
        requestedHistoryDays: 30,
      });
      expect(allow30.allowed).toBe(true);

      const reject90 = evaluateFeatureAccess({
        tier: SubscriptionTier.FREE,
        feature: FeatureKey.HISTORY_RANGE,
        requestedHistoryDays: 90,
      });
      expect(reject90.allowed).toBe(false);
      expect(reject90.requiresUpgrade).toBe(true);
      expect(reject90.limit).toBe(30);
    });

    it('allows Premium user full historical access (365 days)', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.PREMIUM,
        feature: FeatureKey.HISTORY_RANGE,
        requestedHistoryDays: 365,
      });

      expect(result.allowed).toBe(true);
    });

    it('rejects Free user from advanced analytics', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.FREE,
        feature: FeatureKey.ADVANCED_ANALYTICS,
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresUpgrade).toBe(true);
    });

    it('allows Premium user access to advanced analytics', () => {
      const result = evaluateFeatureAccess({
        tier: SubscriptionTier.PREMIUM,
        feature: FeatureKey.ADVANCED_ANALYTICS,
      });

      expect(result.allowed).toBe(true);
    });
  });
});
