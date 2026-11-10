import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { EntitlementsProvider, useEntitlements } from '../src/hooks/useEntitlements';
import { FeatureLimitModal } from '../src/features/subscription/FeatureLimitModal';
import { PaywallScreen } from '../src/features/subscription/PaywallScreen';
import { ManageSubscriptionView } from '../src/features/subscription/ManageSubscriptionView';
import {
  FeatureKey,
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionStore,
} from '@calmeter/shared';
import type { SubscriptionStatusResponseDto } from '@calmeter/contracts';
import {
  mockMonthlyPackage,
  mockAnnualPackage,
  mockCustomerInfoActive,
} from './mocks/react-native-purchases';

describe('Subscription, Payments & Entitlements Mobile Features (Part 12)', () => {
  const freeStatus: SubscriptionStatusResponseDto = {
    tier: SubscriptionTier.FREE,
    status: SubscriptionStatus.FREE,
    store: SubscriptionStore.UNKNOWN,
    planId: null,
    productId: null,
    entitlements: [],
    expiresAt: null,
    autoRenewStatus: false,
    isSandbox: false,
    billingIssue: false,
    cancelReason: null,
    isActive: false,
    isCanceled: false,
    cancelAtPeriodEnd: false,
    dailyUsage: {
      [FeatureKey.AI_PHOTO_SCAN]: { count: 1, limit: 3, remaining: 2 },
      [FeatureKey.BARCODE_SCAN]: { count: 2, limit: 10, remaining: 8 },
      [FeatureKey.COACH_CHAT]: { count: 0, limit: 5, remaining: 5 },
    },
  };

  const premiumStatus: SubscriptionStatusResponseDto = {
    tier: SubscriptionTier.PREMIUM,
    status: SubscriptionStatus.ACTIVE,
    store: SubscriptionStore.APP_STORE,
    planId: 'annual_premium',
    productId: 'calmeter_premium_annual',
    entitlements: ['premium_access'],
    expiresAt: '2026-12-10T00:00:00.000Z',
    autoRenewStatus: true,
    isSandbox: true,
    billingIssue: false,
    cancelReason: null,
    isActive: true,
    isCanceled: false,
    cancelAtPeriodEnd: false,
    dailyUsage: {
      [FeatureKey.AI_PHOTO_SCAN]: { count: 25, limit: 50, remaining: 25 },
    },
  };

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string {
    return root
      .findAllByType(Text)
      .map(node =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : String(node.props.children ?? ''),
      )
      .join(' ');
  }

  // =========================================================================
  // 1. useEntitlements Hook Tests
  // =========================================================================
  describe('useEntitlements Hook', () => {
    it('correctly provides FREE tier values and enforces quota boundaries', async () => {
      let hookState: any = null;

      const HookConsumer: React.FC = () => {
        const val = useEntitlements();
        hookState = val;
        return <Text testID="hook-rendered">Hook Rendered</Text>;
      };

      await act(async () => {
        ReactTestRenderer.create(
          <ThemeProvider>
            <EntitlementsProvider initialStatus={freeStatus}>
              <HookConsumer />
            </EntitlementsProvider>
          </ThemeProvider>,
        );
      });

      expect(hookState).toBeDefined();
      expect(hookState.tier).toBe(SubscriptionTier.FREE);
      expect(hookState.isPremium).toBe(false);
      expect(hookState.isActive).toBe(false);

      // AI Photo Scan quota remaining is 2 (used 1 of 3)
      expect(hookState.canAccess(FeatureKey.AI_PHOTO_SCAN)).toBe(true);
      expect(hookState.getRemainingQuota(FeatureKey.AI_PHOTO_SCAN)).toBe(2);

      // Advanced Analytics requires premium
      expect(hookState.canAccess(FeatureKey.ADVANCED_ANALYTICS)).toBe(false);

      // History range <= 30 days is allowed, > 30 days is blocked
      expect(hookState.canAccess(FeatureKey.HISTORY_RANGE, 14)).toBe(true);
      expect(hookState.canAccess(FeatureKey.HISTORY_RANGE, 60)).toBe(false);
    });

    it('correctly provides PREMIUM tier values with unlimited feature access', async () => {
      let hookState: any = null;

      const HookConsumer: React.FC = () => {
        const val = useEntitlements();
        hookState = val;
        return <Text testID="hook-rendered">Hook Rendered</Text>;
      };

      await act(async () => {
        ReactTestRenderer.create(
          <ThemeProvider>
            <EntitlementsProvider initialStatus={premiumStatus}>
              <HookConsumer />
            </EntitlementsProvider>
          </ThemeProvider>,
        );
      });

      expect(hookState).toBeDefined();
      expect(hookState.tier).toBe(SubscriptionTier.PREMIUM);
      expect(hookState.isPremium).toBe(true);
      expect(hookState.isActive).toBe(true);

      // Premium user can access all features
      expect(hookState.canAccess(FeatureKey.AI_PHOTO_SCAN)).toBe(true);
      expect(hookState.canAccess(FeatureKey.ADVANCED_ANALYTICS)).toBe(true);
      expect(hookState.canAccess(FeatureKey.HISTORY_RANGE, 365)).toBe(true);
      expect(hookState.getRemainingQuota(FeatureKey.AI_PHOTO_SCAN)).toBeNull(); // Unlimited
    });
  });

  // =========================================================================
  // 2. FeatureLimitModal Component Tests
  // =========================================================================
  describe('FeatureLimitModal Component', () => {
    it('renders feature quota information and triggers actions', async () => {
      const handleClose = vi.fn();
      const handleUpgrade = vi.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <FeatureLimitModal
              visible={true}
              feature={FeatureKey.AI_PHOTO_SCAN}
              onClose={handleClose}
              onUpgrade={handleUpgrade}
            />
          </ThemeProvider>,
        );
      });

      const allText = getAllText(renderer!.root);

      expect(allText).toContain('AI Food Photo Scans');
      expect(allText).toContain('3 free AI food photo scans');
      expect(allText).toContain('Upgrade to Premium');
      expect(allText).toContain('Maybe Later');
    });
  });

  // =========================================================================
  // 3. PaywallScreen Component Tests
  // =========================================================================
  describe('PaywallScreen Component', () => {
    it('renders localized offerings, comparison table, and triggers purchase', async () => {
      const mockRcService = {
        initialize: vi.fn(),
        getOfferings: vi.fn().mockResolvedValue({
          current: {
            identifier: 'default',
            serverDescription: 'Default',
            monthly: mockMonthlyPackage,
            annual: mockAnnualPackage,
            availablePackages: [mockMonthlyPackage, mockAnnualPackage],
          },
        }),
        purchasePackage: vi.fn().mockResolvedValue({
          success: true,
          customerInfo: mockCustomerInfoActive,
        }),
        restorePurchases: vi.fn().mockResolvedValue({
          success: true,
          customerInfo: mockCustomerInfoActive,
        }),
        getCustomerInfo: vi.fn().mockResolvedValue(null),
        logIn: vi.fn().mockResolvedValue({ customerInfo: mockCustomerInfoActive, created: false }),
        logOut: vi.fn().mockResolvedValue(mockCustomerInfoActive),
      };

      const mockSubClient: any = {
        syncSubscription: vi.fn().mockResolvedValue(premiumStatus),
      };

      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <PaywallScreen
              onClose={handleClose}
              onSuccess={handleSuccess}
              revenueCatService={mockRcService as any}
              subscriptionClient={mockSubClient}
            />
          </ThemeProvider>,
        );
      });

      const allText = getAllText(renderer!.root);

      // Verify title and plan details
      expect(allText).toContain('CAL METER PREMIUM');
      expect(allText).toContain('Precision Nutrition Without Limits');
      expect(allText).toContain('Annual Plan');
      expect(allText).toContain('Monthly Plan');
      expect(allText).toContain('SAVE 33%');

      // Verify feature comparison entries
      expect(allText).toContain('AI Photo Scans');
      expect(allText).toContain('Barcode Scanning');
      expect(allText).toContain('AI Nutrition Coach Chat');
      expect(allText).toContain('Diary History Range');
      expect(allText).toContain('Advanced Analytics');

      // Verify store legal disclosure
      expect(allText).toContain(
        'Payment will be charged to your Apple App Store or Google Play account',
      );
    });
  });

  // =========================================================================
  // 4. ManageSubscriptionView Component Tests
  // =========================================================================
  describe('ManageSubscriptionView Component', () => {
    it('renders Free Plan badge and upgrade option for free user', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <EntitlementsProvider initialStatus={freeStatus}>
              <ManageSubscriptionView />
            </EntitlementsProvider>
          </ThemeProvider>,
        );
      });

      const allText = getAllText(renderer!.root);

      expect(allText).toContain('Subscription');
      expect(allText).toContain('FREE PLAN');
      expect(allText).toContain('Upgrade to Cal Meter Premium');
      expect(allText).toContain('Restore Purchases');
    });

    it('renders PREMIUM badge and renewal details for active subscriber', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <EntitlementsProvider initialStatus={premiumStatus}>
              <ManageSubscriptionView />
            </EntitlementsProvider>
          </ThemeProvider>,
        );
      });

      const allText = getAllText(renderer!.root);

      expect(allText).toContain('Subscription');
      expect(allText).toContain('PREMIUM');
      expect(allText).toContain('Annual Premium Plan');
      expect(allText).toContain('Auto-renews');
      expect(allText).toContain('Sync Purchases');
    });
  });
});
