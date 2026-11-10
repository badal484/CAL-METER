import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import { AnalyticsEventName } from '@calmeter/shared';

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

describe('Product Analytics & Operational Metrics API (Part 13)', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_USER = 'token-analytics-user';
  let userId: string;

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    verifier = new TestAuthVerifier();
    verifier.register(TOKEN_USER, {
      uid: 'fb-analytics-user',
      email: 'analytics@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const user = await prisma.user.upsert({
      where: { firebaseUid: 'fb-analytics-user' },
      update: {},
      create: {
        firebaseUid: 'fb-analytics-user',
        email: 'analytics@test.com',
        name: 'Analytics User',
      },
    });
    userId = user.id;

    await prisma.analyticsEvent.deleteMany({
      where: { userId },
    });

    app = createApp({ verifier, prisma });
  });

  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany({
      where: { userId },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/analytics/track', () => {
    it('ingests event and strictly strips PII before database storage', async () => {
      const res = await request(app)
        .post('/api/v1/analytics/track')
        .set('Authorization', `Bearer ${TOKEN_USER}`)
        .send({
          eventName: AnalyticsEventName.DIARY_ENTRY_CREATED,
          properties: {
            mealType: 'BREAKFAST',
            calories: 380,
            password: 'super-secret-password',
            token: 'bearer-xyz-123',
            notes: 'Private doctor consultation notes',
            userEmail: 'user@example.com',
          },
          devicePlatform: 'ANDROID',
          appVersion: '1.0.0',
          sessionId: 'session-xyz',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.accepted).toBe(1);

      // Verify database record has sanitized properties
      const eventRecord = await prisma.analyticsEvent.findFirst({
        where: { userId, eventName: AnalyticsEventName.DIARY_ENTRY_CREATED },
        orderBy: { timestamp: 'desc' },
      });

      expect(eventRecord).toBeDefined();
      const props = eventRecord?.properties as Record<string, any>;
      expect(props.mealType).toBe('BREAKFAST');
      expect(props.calories).toBe(380);
      expect(props.password).toBe('[REDACTED]');
      expect(props.token).toBe('[REDACTED]');
      expect(props.notes).toBe('[REDACTED]');
      expect(props.userEmail).toBe('[REDACTED]');
    });

    it('supports anonymous / pre-auth onboarding events with null userId', async () => {
      const res = await request(app)
        .post('/api/v1/analytics/track')
        .send({
          eventName: AnalyticsEventName.ONBOARDING_STARTED,
          properties: { step: 1, flow: 'organic' },
          devicePlatform: 'IOS',
          appVersion: '1.0.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');

      const eventRecord = await prisma.analyticsEvent.findFirst({
        where: { eventName: AnalyticsEventName.ONBOARDING_STARTED, userId: null },
      });
      expect(eventRecord).toBeDefined();
    });
  });

  describe('POST /api/v1/analytics/batch', () => {
    it('ingests batches of events from mobile flushes', async () => {
      const res = await request(app)
        .post('/api/v1/analytics/batch')
        .set('Authorization', `Bearer ${TOKEN_USER}`)
        .send({
          events: [
            {
              eventName: AnalyticsEventName.FOOD_SEARCH_PERFORMED,
              properties: { queryLength: 5, resultsCount: 12 },
            },
            {
              eventName: AnalyticsEventName.WATER_LOGGED,
              properties: { amountMl: 250 },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.accepted).toBe(2);
    });
  });

  describe('Operational Metrics Endpoints', () => {
    it('returns JSON operational metrics at /api/v1/metrics and /health/metrics', async () => {
      const res = await request(app).get('/api/v1/metrics');

      expect(res.status).toBe(200);
      expect(res.body.service).toBe('calmeter-api');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.memoryUsage).toBeDefined();
      expect(typeof res.body.memoryUsage.heapUsedMb).toBe('number');
      expect(res.body.httpMetrics).toBeDefined();
      expect(res.body.httpMetrics.totalRequests).toBeGreaterThanOrEqual(1);

      const healthRes = await request(app).get('/health/metrics');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.service).toBe('calmeter-api');
    });

    it('returns Prometheus plaintext format when format=prometheus or Accept: text/plain', async () => {
      const res = await request(app).get('/metrics?format=prometheus').set('Accept', 'text/plain');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('process_uptime_seconds');
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('process_memory_heap_used_bytes');
    });
  });
});
