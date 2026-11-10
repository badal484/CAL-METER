import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import { MockPushNotificationProvider } from '../src/services/notificationDispatcher.service.js';
import { DevicePlatform, NotificationCategory, NotificationDeliveryStatus } from '@calmeter/shared';

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

describe('Push Notifications & Reminders Engine (Part 13)', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let mockPush: MockPushNotificationProvider;
  let app: any;

  const TOKEN_USER_A = 'token-notif-user-a';
  const TOKEN_USER_B = 'token-notif-user-b';

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    verifier = new TestAuthVerifier();
    verifier.register(TOKEN_USER_A, {
      uid: 'fb-notif-user-a',
      email: 'notif-a@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_USER_B, {
      uid: 'fb-notif-user-b',
      email: 'notif-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const userA = await prisma.user.upsert({
      where: { firebaseUid: 'fb-notif-user-a' },
      update: {},
      create: {
        firebaseUid: 'fb-notif-user-a',
        email: 'notif-a@test.com',
        name: 'Notification User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-notif-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-notif-user-b',
        email: 'notif-b@test.com',
        name: 'Notification User B',
      },
    });
    userBId = userB.id;

    // Clean test data
    await prisma.notificationHistory.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.deviceToken.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });

    mockPush = new MockPushNotificationProvider();
    app = createApp({ verifier, prisma, pushProvider: mockPush });
  });

  afterAll(async () => {
    await prisma.notificationHistory.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.deviceToken.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.$disconnect();
  });

  describe('Device Token Lifecycle', () => {
    const testFcmToken = 'fcm-device-token-user-a-valid-length-1234567890';

    it('registers a device token securely', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          token: testFcmToken,
          platform: DevicePlatform.ANDROID,
          deviceModel: 'Pixel 8',
          osVersion: 'Android 14',
          appVersion: '1.0.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platform).toBe('ANDROID');
      expect(res.body.data.isActive).toBe(true);

      const dbToken = await prisma.deviceToken.findUnique({
        where: { token: testFcmToken },
      });
      expect(dbToken).toBeDefined();
      expect(dbToken?.userId).toBe(userAId);
      expect(dbToken?.deviceModel).toBe('Pixel 8');
    });

    it('updates device metadata idempotently when re-registered', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          token: testFcmToken,
          platform: DevicePlatform.ANDROID,
          deviceModel: 'Pixel 8 Pro',
          osVersion: 'Android 15',
          appVersion: '1.0.1',
        });

      expect(res.status).toBe(200);
      const dbToken = await prisma.deviceToken.findUnique({
        where: { token: testFcmToken },
      });
      expect(dbToken?.deviceModel).toBe('Pixel 8 Pro');
      expect(dbToken?.osVersion).toBe('Android 15');
      expect(dbToken?.appVersion).toBe('1.0.1');
    });

    it('deactivates token on logout / explicit deactivation', async () => {
      const res = await request(app)
        .delete('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          token: testFcmToken,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbToken = await prisma.deviceToken.findUnique({
        where: { token: testFcmToken },
      });
      expect(dbToken?.isActive).toBe(false);
    });
  });

  describe('Notification Preferences & Custom Reminders', () => {
    it('returns default preferences on initial fetch', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.mealReminders).toBe(true);
      expect(res.body.data.breakfastTime).toBe('08:30');
      expect(res.body.data.lunchTime).toBe('13:00');
      expect(res.body.data.dinnerTime).toBe('20:00');
      expect(res.body.data.quietHoursStart).toBe('22:00');
      expect(res.body.data.quietHoursEnd).toBe('07:00');
    });

    it('updates preferences with custom schedule and quiet hours', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          breakfastTime: '07:45',
          lunchTime: '12:30',
          waterIntervalHours: 3,
          quietHoursStart: '23:00',
          quietHoursEnd: '06:00',
          timezone: 'Asia/Kolkata',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.breakfastTime).toBe('07:45');
      expect(res.body.data.lunchTime).toBe('12:30');
      expect(res.body.data.waterIntervalHours).toBe(3);
      expect(res.body.data.quietHoursStart).toBe('23:00');
      expect(res.body.data.quietHoursEnd).toBe('06:00');
    });

    it('rejects invalid time string formats', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          breakfastTime: '26:00',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Notification Dispatch & Delivery Verification', () => {
    const activeTokenA = 'token-active-device-a-1234567890';

    beforeAll(async () => {
      // Register active token for user A
      await prisma.deviceToken.create({
        data: {
          userId: userAId,
          token: activeTokenA,
          platform: DevicePlatform.IOS,
          isActive: true,
        },
      });
    });

    it('dispatches test notification and records delivery history', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/test')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          category: NotificationCategory.MEAL_REMINDER_BREAKFAST,
          title: 'Good morning!',
          body: 'Ready for a healthy breakfast?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(NotificationDeliveryStatus.SENT);
      expect(res.body.data.deviceCount).toBe(1);

      // Verify recorded in notification history
      const historyRes = await request(app)
        .get('/api/v1/notifications/history')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.notifications.length).toBeGreaterThanOrEqual(1);
      expect(historyRes.body.data.notifications[0].title).toBe('Good morning!');
    });

    it('skips delivery when user disables category in preferences', async () => {
      // Disable dinner reminders
      await prisma.notificationPreference.update({
        where: { userId: userAId },
        data: { dinnerReminder: false },
      });

      const res = await request(app)
        .post('/api/v1/notifications/test')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          category: NotificationCategory.MEAL_REMINDER_DINNER,
          title: 'Dinner time',
          body: 'Log dinner',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(NotificationDeliveryStatus.SKIPPED_PREFERENCE);
    });
  });
});
