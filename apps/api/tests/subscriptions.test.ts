import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  PrismaClient,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionStore,
} from '@prisma/client';
import { createApp } from '../src/app.js';
import { resetConfigForTesting } from '../src/config/env.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import { FeatureKey, parseIsoDate } from '@calmeter/shared';

class TestAuthVerifier implements IFirebaseTokenVerifier {
  private users: Map<string, FirebaseDecodedToken> = new Map();

  register(token: string, payload: FirebaseDecodedToken) {
    this.users.set(token, payload);
  }

  async verifyIdToken(token: string): Promise<FirebaseDecodedToken> {
    const user = this.users.get(token);
    if (!user) throw new Error('Invalid test token');
    return user;
  }
}

describe('Subscriptions, Payments & Entitlements API (Part 12)', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const WEBHOOK_SECRET = 'test-rc-webhook-secret-token';
  const TOKEN_FREE_USER = 'token-sub-free-user';
  const TOKEN_PREMIUM_USER = 'token-sub-premium-user';
  const TOKEN_USER_B = 'token-sub-user-b';

  let freeUserId: string;
  let premiumUserId: string;
  let webhookUserId: string;
  let userBId: string;
  const baseTime = Date.now();

  beforeAll(async () => {
    // Configure test environment auth token and reset config cache
    process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = WEBHOOK_SECRET;
    resetConfigForTesting();

    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    verifier = new TestAuthVerifier();
    verifier.register(TOKEN_FREE_USER, {
      uid: 'fb-sub-free-user',
      email: 'sub-free@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_PREMIUM_USER, {
      uid: 'fb-sub-premium-user',
      email: 'sub-premium@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_USER_B, {
      uid: 'fb-sub-user-b',
      email: 'sub-user-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Clean up any existing test records
    await prisma.revenueCatWebhookEvent.deleteMany({});
    await prisma.userFeatureUsage.deleteMany({});
    await prisma.subscription.deleteMany({});

    // Upsert test users
    const freeUser = await prisma.user.upsert({
      where: { firebaseUid: 'fb-sub-free-user' },
      update: {},
      create: {
        firebaseUid: 'fb-sub-free-user',
        email: 'sub-free@test.com',
      },
    });
    freeUserId = freeUser.id;

    const premiumUser = await prisma.user.upsert({
      where: { firebaseUid: 'fb-sub-premium-user' },
      update: {},
      create: {
        firebaseUid: 'fb-sub-premium-user',
        email: 'sub-premium@test.com',
      },
    });
    premiumUserId = premiumUser.id;

    const webhookUser = await prisma.user.upsert({
      where: { firebaseUid: 'fb-sub-webhook-user' },
      update: {},
      create: {
        firebaseUid: 'fb-sub-webhook-user',
        email: 'sub-webhook@test.com',
      },
    });
    webhookUserId = webhookUser.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-sub-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-sub-user-b',
        email: 'sub-user-b@test.com',
      },
    });
    userBId = userB.id;

    app = createApp({ verifier, prisma });
  });

  afterAll(async () => {
    await prisma.revenueCatWebhookEvent.deleteMany({});
    await prisma.userFeatureUsage.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Webhook Authentication
  // =========================================================================
  describe('RevenueCat Webhook Authentication', () => {
    it('rejects webhooks without Authorization header (401)', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_auth_missing',
            type: 'INITIAL_PURCHASE',
            app_user_id: webhookUserId,
            original_app_user_id: webhookUserId,
            product_id: 'calmeter_premium_monthly',
            purchased_at_ms: Date.now(),
            event_timestamp_ms: baseTime + 10,
          },
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('rejects webhooks with incorrect Bearer token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', 'Bearer wrong-secret-token')
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_auth_wrong',
            type: 'INITIAL_PURCHASE',
            app_user_id: webhookUserId,
            original_app_user_id: webhookUserId,
            product_id: 'calmeter_premium_monthly',
            purchased_at_ms: Date.now(),
            event_timestamp_ms: baseTime + 20,
          },
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('accepts webhooks with valid Bearer token (200)', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_auth_valid_1',
            type: 'INITIAL_PURCHASE',
            app_user_id: premiumUserId,
            original_app_user_id: premiumUserId,
            product_id: 'calmeter_premium_monthly',
            entitlement_id: 'premium',
            store: 'APP_STORE',
            purchased_at_ms: Date.now(),
            expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
            event_timestamp_ms: baseTime + 30,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PROCESSED');
    });
  });

  // =========================================================================
  // 2. Webhook Event Processing Lifecycle
  // =========================================================================
  describe('RevenueCat Webhook Lifecycle Events', () => {
    it('processes INITIAL_PURCHASE and activates subscription', async () => {
      const expiresAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_init_purchase_test',
            type: 'INITIAL_PURCHASE',
            app_user_id: premiumUserId,
            original_app_user_id: premiumUserId,
            product_id: 'calmeter_premium_monthly',
            entitlement_id: 'premium',
            store: 'APP_STORE',
            purchased_at_ms: Date.now(),
            expiration_at_ms: expiresAtMs,
            event_timestamp_ms: baseTime + 100,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PROCESSED');

      // Verify DB record
      const sub = await prisma.subscription.findUnique({
        where: { userId: premiumUserId },
      });
      expect(sub).toBeDefined();
      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub?.tier).toBe(SubscriptionTier.PREMIUM);
      expect(sub?.store).toBe(SubscriptionStore.APP_STORE);
      expect(sub?.productId).toBe('calmeter_premium_monthly');
      expect(sub?.autoRenewStatus).toBe(true);
    });

    it('processes RENEWAL and updates expiration date', async () => {
      const newExpiresAtMs = Date.now() + 60 * 24 * 60 * 60 * 1000;
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_renewal_test',
            type: 'RENEWAL',
            app_user_id: premiumUserId,
            original_app_user_id: premiumUserId,
            product_id: 'calmeter_premium_monthly',
            entitlement_id: 'premium',
            store: 'APP_STORE',
            purchased_at_ms: Date.now(),
            expiration_at_ms: newExpiresAtMs,
            event_timestamp_ms: baseTime + 200,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PROCESSED');

      const sub = await prisma.subscription.findUnique({
        where: { userId: premiumUserId },
      });
      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub?.expiresAt?.getTime()).toBe(newExpiresAtMs);
    });

    it('processes CANCELLATION without immediately revoking premium access', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_cancellation_test',
            type: 'CANCELLATION',
            app_user_id: premiumUserId,
            original_app_user_id: premiumUserId,
            product_id: 'calmeter_premium_monthly',
            entitlement_id: 'premium',
            event_timestamp_ms: baseTime + 300,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PROCESSED');

      const sub = await prisma.subscription.findUnique({
        where: { userId: premiumUserId },
      });
      expect(sub?.status).toBe(SubscriptionStatus.CANCELED);
      expect(sub?.autoRenewStatus).toBe(false);

      // Verify that user STILL has effective PREMIUM access because expiresAt is in the future
      const statusRes = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${TOKEN_PREMIUM_USER}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.tier).toBe('PREMIUM');
      expect(statusRes.body.data.isActive).toBe(true);
      expect(statusRes.body.data.isCanceled).toBe(true);
      expect(statusRes.body.data.cancelAtPeriodEnd).toBe(true);
    });

    it('processes EXPIRATION and revokes premium access to FREE', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_expiration_test',
            type: 'EXPIRATION',
            app_user_id: premiumUserId,
            original_app_user_id: premiumUserId,
            product_id: 'calmeter_premium_monthly',
            entitlement_id: 'premium',
            event_timestamp_ms: baseTime + 400,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PROCESSED');

      const sub = await prisma.subscription.findUnique({
        where: { userId: premiumUserId },
      });
      expect(sub?.status).toBe(SubscriptionStatus.EXPIRED);
      expect(sub?.tier).toBe(SubscriptionTier.FREE);

      // Verify status endpoint reflects FREE
      const statusRes = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${TOKEN_PREMIUM_USER}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.tier).toBe('FREE');
      expect(statusRes.body.data.isActive).toBe(false);
    });

    it('processes BILLING_ISSUE and records the timestamp', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_billing_issue_test',
            type: 'BILLING_ISSUE',
            app_user_id: premiumUserId,
            original_app_user_id: premiumUserId,
            product_id: 'calmeter_premium_monthly',
            entitlement_id: 'premium',
            event_timestamp_ms: baseTime + 500,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PROCESSED');

      const sub = await prisma.subscription.findUnique({
        where: { userId: premiumUserId },
      });
      expect(sub?.billingIssueDetectedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Webhook Idempotency & Out-of-Order Safety
  // =========================================================================
  describe('Webhook Idempotency and Out-of-Order Protection', () => {
    it('returns IGNORED_DUPLICATE for duplicate event ID without throwing', async () => {
      const eventPayload = {
        api_version: '1.0',
        event: {
          id: 'evt_duplicate_idempotency_test',
          type: 'RENEWAL',
          app_user_id: webhookUserId,
          original_app_user_id: webhookUserId,
          product_id: 'calmeter_premium_annual',
          entitlement_id: 'premium',
          store: 'PLAY_STORE',
          purchased_at_ms: Date.now(),
          expiration_at_ms: Date.now() + 365 * 24 * 60 * 60 * 1000,
          event_timestamp_ms: baseTime + 1000,
        },
      };

      // First call
      const firstRes = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send(eventPayload);

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.data.status).toBe('PROCESSED');

      // Duplicate call with identical event id
      const secondRes = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send(eventPayload);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.status).toBe('IGNORED_DUPLICATE');
    });

    it('returns IGNORED_OUT_OF_ORDER when older event arrives after newer event', async () => {
      // First, set subscription to a newer timestamp
      const newerRes = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_newer_event',
            type: 'RENEWAL',
            app_user_id: webhookUserId,
            original_app_user_id: webhookUserId,
            product_id: 'calmeter_premium_annual',
            entitlement_id: 'premium',
            event_timestamp_ms: baseTime + 5000,
          },
        });
      expect(newerRes.status).toBe(200);
      expect(newerRes.body.data.status).toBe('PROCESSED');

      // Now send an older event (event_timestamp_ms: baseTime + 2000 < baseTime + 5000)
      const olderRes = await request(app)
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', `Bearer ${WEBHOOK_SECRET}`)
        .send({
          api_version: '1.0',
          event: {
            id: 'evt_older_stale_event',
            type: 'CANCELLATION',
            app_user_id: webhookUserId,
            original_app_user_id: webhookUserId,
            product_id: 'calmeter_premium_annual',
            entitlement_id: 'premium',
            event_timestamp_ms: baseTime + 2000,
          },
        });

      expect(olderRes.status).toBe(200);
      expect(olderRes.body.data.status).toBe('IGNORED_OUT_OF_ORDER');
    });
  });

  // =========================================================================
  // 4. Subscription Status API & Multi-Tenant Isolation
  // =========================================================================
  describe('Subscription Status API (GET /api/v1/subscriptions/status)', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/subscriptions/status');
      expect(res.status).toBe(401);
    });

    it('returns FREE tier with default limits for default/new user', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tier).toBe('FREE');
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.dailyUsage).toBeDefined();
      expect(res.body.data.dailyUsage.AI_PHOTO_SCAN.limit).toBe(3);
      expect(res.body.data.dailyUsage.COACH_CHAT.limit).toBe(5);
      expect(res.body.data.quotas.ADVANCED_ANALYTICS.isAllowed).toBe(false);
      expect(res.body.data.quotas.HISTORY_RANGE.freeMaxHistoryDays).toBe(30);
    });

    it('enforces multi-tenant isolation: User A cannot see User B subscription', async () => {
      // User B has no active subscription initially
      const userBRes = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(userBRes.body.data.tier).toBe('FREE');
      expect(userBRes.body.data.isActive).toBe(false);

      // Now create an active subscription for User B directly
      await prisma.subscription.upsert({
        where: { userId: userBId },
        update: {
          revenueCatAppUserId: userBId,
          tier: SubscriptionTier.PREMIUM,
          status: SubscriptionStatus.ACTIVE,
          productId: 'calmeter_premium_annual',
          store: SubscriptionStore.PLAY_STORE,
          expiresAt: new Date(Date.now() + 10000000),
        },
        create: {
          userId: userBId,
          revenueCatAppUserId: userBId,
          tier: SubscriptionTier.PREMIUM,
          status: SubscriptionStatus.ACTIVE,
          productId: 'calmeter_premium_annual',
          store: SubscriptionStore.PLAY_STORE,
          expiresAt: new Date(Date.now() + 10000000),
        },
      });

      // User B now sees PREMIUM
      const userBUpdated = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(userBUpdated.body.data.tier).toBe('PREMIUM');
      expect(userBUpdated.body.data.isActive).toBe(true);

      // Free user should see their own FREE state
      const freeRes = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(freeRes.body.data.tier).toBe('FREE');
      expect(freeRes.body.data.isActive).toBe(false);
    });
  });

  // =========================================================================
  // 5. Feature Access & Daily Quotas
  // =========================================================================
  describe('Feature Access & Daily Quotas (GET /api/v1/subscriptions/check-access)', () => {
    it('validates feature access query params', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: 'INVALID_FEATURE_KEY' })
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns allowed quota status for free user when under limit', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.AI_PHOTO_SCAN })
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(res.status).toBe(200);
      expect(res.body.data.allowed).toBe(true);
      expect(res.body.data.canAccess).toBe(true);
      expect(res.body.data.limit).toBe(3);
      expect(res.body.data.currentUsage).toBe(0);
      expect(res.body.data.remaining).toBe(3);
      expect(res.body.data.tier).toBe('FREE');
    });

    it('denies access when daily quota is exhausted for free user', async () => {
      const todayDate = parseIsoDate(new Date().toISOString().slice(0, 10));

      // Artificially exhaust free user's daily quota to 3
      await prisma.userFeatureUsage.upsert({
        where: {
          userId_feature_date: {
            userId: freeUserId,
            feature: FeatureKey.AI_PHOTO_SCAN,
            date: todayDate,
          },
        },
        update: { count: 3 },
        create: {
          userId: freeUserId,
          feature: FeatureKey.AI_PHOTO_SCAN,
          date: todayDate,
          count: 3,
        },
      });

      const res = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.AI_PHOTO_SCAN })
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(res.status).toBe(200);
      expect(res.body.data.allowed).toBe(false);
      expect(res.body.data.canAccess).toBe(false);
      expect(res.body.data.currentUsage).toBe(3);
      expect(res.body.data.remaining).toBe(0);
    });

    it('allows access for premium user beyond free quota limits', async () => {
      const todayDate = parseIsoDate(new Date().toISOString().slice(0, 10));

      // Set usage to 20 for User B (who is PREMIUM; free limit is 3, premium limit is 50)
      await prisma.userFeatureUsage.upsert({
        where: {
          userId_feature_date: {
            userId: userBId,
            feature: FeatureKey.AI_PHOTO_SCAN,
            date: todayDate,
          },
        },
        update: { count: 20 },
        create: {
          userId: userBId,
          feature: FeatureKey.AI_PHOTO_SCAN,
          date: todayDate,
          count: 20,
        },
      });

      const res = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.AI_PHOTO_SCAN })
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(res.status).toBe(200);
      expect(res.body.data.allowed).toBe(true);
      expect(res.body.data.tier).toBe('PREMIUM');
      expect(res.body.data.currentUsage).toBe(20);
      expect(res.body.data.remaining).toBe(30);
    });

    it('denies ADVANCED_ANALYTICS to free users and allows to premium users', async () => {
      // Free user
      const freeRes = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.ADVANCED_ANALYTICS })
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(freeRes.status).toBe(200);
      expect(freeRes.body.data.allowed).toBe(false);
      expect(freeRes.body.data.canAccess).toBe(false);

      // Premium user
      const premRes = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.ADVANCED_ANALYTICS })
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(premRes.status).toBe(200);
      expect(premRes.body.data.allowed).toBe(true);
      expect(premRes.body.data.canAccess).toBe(true);
    });

    it('enforces 30-day history limit for free users and allows unlimited for premium users', async () => {
      // Free user querying 20 days -> allowed
      const res20 = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.HISTORY_RANGE, historyDays: 20 })
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(res20.status).toBe(200);
      expect(res20.body.data.allowed).toBe(true);
      expect(res20.body.data.canAccess).toBe(true);

      // Free user querying 90 days -> denied
      const res90 = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.HISTORY_RANGE, historyDays: 90 })
        .set('Authorization', `Bearer ${TOKEN_FREE_USER}`);

      expect(res90.status).toBe(200);
      expect(res90.body.data.allowed).toBe(false);
      expect(res90.body.data.canAccess).toBe(false);

      // Premium user querying 365 days -> allowed
      const resPrem365 = await request(app)
        .get('/api/v1/subscriptions/check-access')
        .query({ feature: FeatureKey.HISTORY_RANGE, historyDays: 365 })
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(resPrem365.status).toBe(200);
      expect(resPrem365.body.data.allowed).toBe(true);
      expect(resPrem365.body.data.canAccess).toBe(true);
    });
  });

  // =========================================================================
  // 6. Entitlement Synchronization API
  // =========================================================================
  describe('Subscription Sync API (POST /api/v1/subscriptions/sync)', () => {
    it('syncs subscription state successfully', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/sync')
        .set('Authorization', `Bearer ${TOKEN_USER_B}`)
        .send({ appUserId: userBId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tier).toBe('PREMIUM');
      expect(res.body.data.isActive).toBe(true);
    });
  });

  // =========================================================================
  // 7. Atomic Concurrency Quota Increments
  // =========================================================================
  describe('Atomic Usage Increment Concurrency', () => {
    it('handles parallel concurrent quota increments without lost updates', async () => {
      const { SubscriptionService } = await import('../src/services/subscription.service.js');
      const service = new SubscriptionService({ prisma });
      const testDateStr = '2026-12-01';
      const testDate = parseIsoDate(testDateStr);

      // Clean up test date usage
      await prisma.userFeatureUsage.deleteMany({
        where: { userId: freeUserId, date: testDate },
      });

      // Run 10 parallel atomic increments
      const incrementPromises = Array.from({ length: 10 }).map(() =>
        service.incrementFeatureUsage(freeUserId, FeatureKey.COACH_CHAT, testDateStr),
      );

      await Promise.all(incrementPromises);

      const usageRecord = await prisma.userFeatureUsage.findUnique({
        where: {
          userId_feature_date: {
            userId: freeUserId,
            feature: FeatureKey.COACH_CHAT,
            date: testDate,
          },
        },
      });

      expect(usageRecord).toBeDefined();
      expect(usageRecord?.count).toBe(10);
    });
  });
});
