import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';

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

describe('User Onboarding, Nutrition Goals & Personalization API', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_USER_A = 'token-onboarding-user-a';
  const TOKEN_USER_B = 'token-onboarding-user-b';

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
      uid: 'fb-onboarding-user-a',
      email: 'onboard-a@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_USER_B, {
      uid: 'fb-onboarding-user-b',
      email: 'onboard-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const userA = await prisma.user.upsert({
      where: { firebaseUid: 'fb-onboarding-user-a' },
      update: {},
      create: {
        firebaseUid: 'fb-onboarding-user-a',
        email: 'onboard-a@test.com',
        name: 'Onboard User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-onboarding-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-onboarding-user-b',
        email: 'onboard-b@test.com',
        name: 'Onboard User B',
      },
    });
    userBId = userB.id;

    // Clean up test data for these users
    await prisma.weightLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.nutritionGoal.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    await prisma.weightLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.nutritionGoal.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/profile (unonboarded state)', () => {
    it('returns 404 when profile does not exist yet', async () => {
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/onboarding/complete', () => {
    it('rejects onboarding for minors (under 18 years)', async () => {
      const minorPayload = {
        name: 'Minor User',
        dob: '2015-05-15', // Under 18
        gender: 'MALE',
        biologicalSex: 'MALE',
        heightCm: 160,
        currentWeightKg: 50,
        primaryGoal: 'MAINTAIN_WEIGHT',
        activityLevel: 'SEDENTARY',
        paceKgPerWeek: 0.5,
        dietPreference: 'ANY',
      };

      const res = await request(app)
        .post('/api/v1/onboarding/complete')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send(minorPayload);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/18 years/i);
    });

    it('rejects onboarding with out-of-bounds weight or height', async () => {
      const invalidPayload = {
        name: 'Out of Bounds User',
        dob: '1995-01-01',
        gender: 'FEMALE',
        biologicalSex: 'FEMALE',
        heightCm: 45, // below 100 cm
        currentWeightKg: 70,
        primaryGoal: 'LOSE_WEIGHT',
        activityLevel: 'LIGHTLY_ACTIVE',
        paceKgPerWeek: 0.5,
      };

      const res = await request(app)
        .post('/api/v1/onboarding/complete')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
    });

    it('successfully completes onboarding and atomically persists profile, goal, and weight log', async () => {
      const onboardingPayload = {
        name: 'Alex Johnson',
        dob: '1996-06-15',
        gender: 'MALE',
        biologicalSex: 'MALE',
        heightCm: 178,
        currentWeightKg: 80,
        targetWeightKg: 75,
        primaryGoal: 'LOSE_WEIGHT',
        activityLevel: 'MODERATELY_ACTIVE',
        paceKgPerWeek: 0.5,
        dietPreference: 'VEGETARIAN',
      };

      const res = await request(app)
        .post('/api/v1/onboarding/complete')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send(onboardingPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.profile).toBeDefined();
      expect(data.profile.userId).toBe(userAId);
      expect(data.profile.heightCm).toBe(178);
      expect(data.profile.currentWeightKg).toBe(80);
      expect(data.profile.targetWeightKg).toBe(75);
      expect(data.profile.biologicalSex).toBe('MALE');
      expect(data.profile.dietPreference).toBe('VEGETARIAN');

      expect(data.goal).toBeDefined();
      expect(data.goal.userId).toBe(userAId);
      expect(data.goal.status).toBe('ACTIVE');
      expect(data.goal.dailyCalories).toBeGreaterThan(1200);
      expect(data.goal.proteinGrams).toBeGreaterThan(0);
      expect(data.goal.carbsGrams).toBeGreaterThan(0);
      expect(data.goal.fatGrams).toBeGreaterThan(0);

      expect(data.calculations).toBeDefined();
      expect(data.calculations.bmr).toBeGreaterThan(1500);
      expect(data.calculations.tdee).toBeGreaterThan(data.calculations.bmr);
      expect(data.calculations.dailyDeficitOrSurplus).toBeLessThan(0); // LOSE_WEIGHT deficit
      expect(data.calculations.disclaimers.length).toBeGreaterThan(0);

      // Verify baseline weight log was created
      const weightLogs = await prisma.weightLog.findMany({ where: { userId: userAId } });
      expect(weightLogs.length).toBe(1);
      expect(Number(weightLogs[0].weightKg)).toBe(80);
      expect(weightLogs[0].notes).toBe('Baseline measurement from onboarding');
    });

    it('is idempotent: completing onboarding again updates profile without duplicating goals', async () => {
      const updatedPayload = {
        name: 'Alex Johnson Updated',
        dob: '1996-06-15',
        gender: 'MALE',
        biologicalSex: 'MALE',
        heightCm: 178,
        currentWeightKg: 82,
        targetWeightKg: 74,
        primaryGoal: 'LOSE_WEIGHT',
        activityLevel: 'VERY_ACTIVE',
        paceKgPerWeek: 0.5,
      };

      const res = await request(app)
        .post('/api/v1/onboarding/complete')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send(updatedPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.profile.currentWeightKg).toBe(82);

      // Verify profile is updated in DB
      const profile = await prisma.userProfile.findUnique({ where: { userId: userAId } });
      expect(Number(profile?.currentWeightKg)).toBe(82);
    });
  });

  describe('GET /api/v1/profile and PATCH /api/v1/profile', () => {
    it('retrieves user profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(userAId);
      expect(res.body.data.heightCm).toBe(178);
      expect(res.body.data.currentWeightKg).toBe(82);
      expect(res.body.data.biologicalSex).toBe('MALE');
    });

    it('updates user profile via PATCH and syncs weight log if weight changed', async () => {
      const patchPayload = {
        name: 'Alexander J.',
        currentWeightKg: 81.5,
        activityLevel: 'LIGHTLY_ACTIVE',
      };

      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send(patchPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Alexander J.');
      expect(res.body.data.currentWeightKg).toBe(81.5);
      expect(res.body.data.activityLevel).toBe('LIGHTLY_ACTIVE');

      // Check weight log was added
      const logs = await prisma.weightLog.findMany({
        where: { userId: userAId },
        orderBy: { loggedAt: 'desc' },
      });
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(Number(logs[0].weightKg)).toBe(81.5);
    });
  });

  describe('GET /api/v1/goals/current and GET /api/v1/goals', () => {
    it('retrieves current active goal for today', async () => {
      const res = await request(app)
        .get('/api/v1/goals/current')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.userId).toBe(userAId);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.dailyCalories).toBeGreaterThan(0);
    });

    it('retrieves goal history list', async () => {
      const res = await request(app)
        .get('/api/v1/goals')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/goals/recalculate', () => {
    it('returns calculated calorie and macro targets without writing to database', async () => {
      const goalCountBefore = await prisma.nutritionGoal.count({ where: { userId: userAId } });

      const res = await request(app)
        .post('/api/v1/goals/recalculate')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          primaryGoal: 'BUILD_MUSCLE',
          paceKgPerWeek: 0.25,
          activityLevel: 'VERY_ACTIVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.dailyDeficitOrSurplus).toBeGreaterThan(0); // surplus
      expect(res.body.data.suggestedCalories).toBeGreaterThan(2000);
      expect(res.body.data.proteinGrams).toBeGreaterThan(0);
      expect(res.body.data.disclaimers.length).toBeGreaterThan(0);

      const goalCountAfter = await prisma.nutritionGoal.count({ where: { userId: userAId } });
      expect(goalCountAfter).toBe(goalCountBefore);
    });

    it('applies custom calorie override and recalculates macros consistently', async () => {
      const res = await request(app)
        .post('/api/v1/goals/recalculate')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          customCalorieOverride: 2400,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.suggestedCalories).toBe(2400);
    });
  });

  describe('POST /api/v1/goals and PATCH /api/v1/goals/:id', () => {
    let newGoalId: string;

    it('creates a new goal with future or current effective date, superseding prior active', async () => {
      const res = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          dailyCalories: 2350,
          proteinGrams: 150,
          carbsGrams: 250,
          fatGrams: 65,
          fiberGrams: 32,
          effectiveDate: '2026-12-01',
          primaryGoal: 'MAINTAIN_WEIGHT',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.dailyCalories).toBe(2350);
      expect(res.body.data.effectiveDate).toBe('2026-12-01');
      newGoalId = res.body.data.id;
    });

    it('updates specific goal via PATCH', async () => {
      const res = await request(app)
        .patch(`/api/v1/goals/${newGoalId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          dailyCalories: 2400,
          proteinGrams: 160,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.dailyCalories).toBe(2400);
      expect(res.body.data.proteinGrams).toBe(160);
    });

    it('enforces multi-tenant isolation: User B cannot modify User A goal', async () => {
      const res = await request(app)
        .patch(`/api/v1/goals/${newGoalId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_B}`)
        .send({
          dailyCalories: 3000,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('Weight Tracking: POST and GET /api/v1/tracking/weight', () => {
    it('records a new weight entry and updates profile currentWeightKg', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          weightKg: 80.8,
          notes: 'Morning weigh-in before breakfast',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.weightKg).toBe(80.8);
      expect(res.body.data.notes).toBe('Morning weigh-in before breakfast');

      // Verify profile currentWeightKg synced
      const profile = await prisma.userProfile.findUnique({ where: { userId: userAId } });
      expect(Number(profile?.currentWeightKg)).toBe(80.8);
    });

    it('retrieves weight history', async () => {
      const res = await request(app)
        .get('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].weightKg).toBe(80.8);
    });

    it('rejects invalid weight measurements', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          weightKg: 500, // exceeds 350
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Multi-Tenant Privacy & Protection', () => {
    it('User B cannot view User A profile or goal data', async () => {
      // User B has not completed onboarding
      const resProfile = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);
      expect(resProfile.status).toBe(404);

      const resGoal = await request(app)
        .get('/api/v1/goals/current')
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);
      expect(resGoal.status).toBe(200);
      expect(resGoal.body.data).toBeNull();
    });
  });
});
