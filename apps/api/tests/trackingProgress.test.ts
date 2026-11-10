import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import { ExerciseCategory, ExerciseIntensity, CalorieEstimateSource } from '@calmeter/shared';

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

describe('Weight, Water, Exercise & Progress Tracking API (Part 10)', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_USER_A = 'token-tracking-user-a';
  const TOKEN_USER_B = 'token-tracking-user-b';

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
      uid: 'fb-tracking-user-a',
      email: 'tracking-a@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_USER_B, {
      uid: 'fb-tracking-user-b',
      email: 'tracking-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const userA = await prisma.user.upsert({
      where: { firebaseUid: 'fb-tracking-user-a' },
      update: {},
      create: {
        firebaseUid: 'fb-tracking-user-a',
        email: 'tracking-a@test.com',
        name: 'Tracking User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-tracking-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-tracking-user-b',
        email: 'tracking-b@test.com',
        name: 'Tracking User B',
      },
    });
    userBId = userB.id;

    // Clean up test data for these users
    await prisma.exerciseLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.waterLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.weightLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.nutritionGoal.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });

    // Seed Profile for User A (80 kg current, 72 kg target)
    await prisma.userProfile.create({
      data: {
        userId: userAId,
        dob: new Date('1990-05-15'),
        gender: 'MALE',
        heightCm: 178,
        currentWeightKg: 80.0,
        targetWeightKg: 72.0,
        activityLevel: 'LIGHTLY_ACTIVE',
        primaryGoal: 'LOSE_WEIGHT',
      },
    });

    // Seed active goal with 2800 ml water target
    await prisma.nutritionGoal.create({
      data: {
        userId: userAId,
        dailyCalories: 2100,
        proteinGrams: 140,
        carbsGrams: 230,
        fatGrams: 70,
        waterMl: 2800,
        effectiveDate: new Date('2026-01-01'),
      },
    });

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    await prisma.exerciseLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.waterLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.weightLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.nutritionGoal.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  // ============================================================================
  // 1. WEIGHT TRACKING
  // ============================================================================
  describe('Weight Tracking Endpoints', () => {
    let createdWeightLogId: string;

    it('rejects weight log under 30 kg or above 350 kg', async () => {
      const underRes = await request(app)
        .post('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ weightKg: 25.0 });

      expect(underRes.status).toBe(400);

      const overRes = await request(app)
        .post('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ weightKg: 400.0 });

      expect(overRes.status).toBe(400);
    });

    it('successfully logs a valid weight and synchronizes profile currentWeightKg', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          weightKg: 79.5,
          notes: 'Morning weigh-in before breakfast',
          source: 'MANUAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weightKg).toBe(79.5);
      expect(res.body.data.notes).toBe('Morning weigh-in before breakfast');
      createdWeightLogId = res.body.data.id;

      // Verify profile currentWeightKg was updated
      const profile = await prisma.userProfile.findUnique({ where: { userId: userAId } });
      expect(Number(profile?.currentWeightKg)).toBe(79.5);
    });

    it('handles idempotent submissions within 10 seconds gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          weightKg: 79.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(createdWeightLogId);

      // Verify no duplicate record created
      const count = await prisma.weightLog.count({ where: { userId: userAId } });
      expect(count).toBe(1);
    });

    it('retrieves weight history', async () => {
      // Add another historical entry
      await prisma.weightLog.create({
        data: {
          userId: userAId,
          weightKg: 81.0,
          loggedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        },
      });

      const res = await request(app)
        .get('/api/v1/tracking/weight')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].weightKg).toBe(79.5); // latest first
      expect(res.body.data[1].weightKg).toBe(81.0);
    });

    it('computes weight progress summary correctly', async () => {
      const res = await request(app)
        .get('/api/v1/tracking/weight/summary')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data;
      expect(summary.currentWeightKg).toBe(79.5);
      expect(summary.startWeightKg).toBe(81.0);
      expect(summary.targetWeightKg).toBe(72.0);
      expect(summary.previousWeightKg).toBe(81.0);
      expect(summary.netChangeKg).toBe(-1.5);
      expect(summary.trend).toBe('LOSING');
      expect(summary.progressPercentage).toBeGreaterThan(0);
    });

    it('updates a weight entry and re-syncs profile', async () => {
      const res = await request(app)
        .patch(`/api/v1/tracking/weight/${createdWeightLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          weightKg: 79.2,
          notes: 'Updated morning weigh-in',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.weightKg).toBe(79.2);

      const profile = await prisma.userProfile.findUnique({ where: { userId: userAId } });
      expect(Number(profile?.currentWeightKg)).toBe(79.2);
    });

    it('enforces multi-tenant isolation on weight update and delete', async () => {
      // User B tries to update User A's weight entry
      const updateRes = await request(app)
        .patch(`/api/v1/tracking/weight/${createdWeightLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_B}`)
        .send({ weightKg: 75.0 });

      expect(updateRes.status).toBe(404);

      // User B tries to delete User A's weight entry
      const deleteRes = await request(app)
        .delete(`/api/v1/tracking/weight/${createdWeightLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(deleteRes.status).toBe(404);
    });

    it('deletes a weight entry and updates profile to remaining latest weight', async () => {
      const res = await request(app)
        .delete(`/api/v1/tracking/weight/${createdWeightLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Remaining entry was 81.0 kg
      const profile = await prisma.userProfile.findUnique({ where: { userId: userAId } });
      expect(Number(profile?.currentWeightKg)).toBe(81.0);
    });
  });

  // ============================================================================
  // 2. WATER TRACKING
  // ============================================================================
  describe('Water Tracking Endpoints', () => {
    const today = '2026-11-10';
    let waterLogId: string;

    it('rejects invalid water amount (<= 0 or > 5000 ml)', async () => {
      const zeroRes = await request(app)
        .post('/api/v1/tracking/water')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ amountMl: 0, date: today });
      expect(zeroRes.status).toBe(400);

      const overRes = await request(app)
        .post('/api/v1/tracking/water')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ amountMl: 6000, date: today });
      expect(overRes.status).toBe(400);
    });

    it('logs water intake successfully', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/water')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          amountMl: 500,
          date: today,
          source: 'QUICK_ADD',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountMl).toBe(500);
      expect(res.body.data.date).toBe(today);
      waterLogId = res.body.data.id;
    });

    it('supports quick-add entries and calculates daily summary against active goal', async () => {
      // Add +250 ml and +750 ml
      await request(app)
        .post('/api/v1/tracking/water')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ amountMl: 250, date: today });

      await request(app)
        .post('/api/v1/tracking/water')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ amountMl: 750, date: today });

      const res = await request(app)
        .get(`/api/v1/tracking/water/summary/${today}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data;
      // 500 + 250 + 750 = 1500 ml
      expect(summary.totalMl).toBe(1500);
      expect(summary.targetMl).toBe(2800); // from active goal
      expect(summary.percentage).toBe(53.6); // 1500/2800 * 100 = 53.57% -> 53.6%
      expect(summary.entries.length).toBe(3);
      expect(summary.disclaimer).toBeDefined();
    });

    it('retrieves water entries for a date', async () => {
      const res = await request(app)
        .get(`/api/v1/tracking/water/${today}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });

    it('updates a water log entry', async () => {
      const res = await request(app)
        .patch(`/api/v1/tracking/water/${waterLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({ amountMl: 600 });

      expect(res.status).toBe(200);
      expect(res.body.data.amountMl).toBe(600);
    });

    it('enforces multi-tenant isolation on water log manipulation', async () => {
      const res = await request(app)
        .delete(`/api/v1/tracking/water/${waterLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(res.status).toBe(404);
    });

    it('deletes a water log entry', async () => {
      const res = await request(app)
        .delete(`/api/v1/tracking/water/${waterLogId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================================
  // 3. EXERCISE TRACKING
  // ============================================================================
  describe('Exercise Tracking Endpoints', () => {
    let exerciseId: string;

    it('rejects invalid exercise duration (0 or > 1440 min)', async () => {
      const zeroRes = await request(app)
        .post('/api/v1/tracking/exercise')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          name: 'Morning Run',
          category: ExerciseCategory.RUNNING,
          durationMinutes: 0,
        });
      expect(zeroRes.status).toBe(400);

      const overRes = await request(app)
        .post('/api/v1/tracking/exercise')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          name: 'Marathon',
          category: ExerciseCategory.RUNNING,
          durationMinutes: 2000,
        });
      expect(overRes.status).toBe(400);
    });

    it('logs exercise with manual calories burned', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/exercise')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          name: 'Treadmill Jog',
          category: ExerciseCategory.RUNNING,
          durationMinutes: 30,
          intensity: ExerciseIntensity.MODERATE,
          distanceKm: 4.5,
          caloriesBurned: 320,
          notes: 'Felt energetic',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caloriesBurned).toBe(320);
      expect(res.body.data.calorieSource).toBe(CalorieEstimateSource.MANUAL_ENTRY);
      expect(res.body.data.distanceKm).toBe(4.5);
      exerciseId = res.body.data.id;
    });

    it('logs exercise with automated MET calorie estimation based on user weight', async () => {
      // User A profile weight is 81.0 kg (after latest delete)
      // Running vigorous MET is 11.5
      // 11.5 * 81.0 * (45 / 60) = 698.625 -> 699 kcal
      const res = await request(app)
        .post('/api/v1/tracking/exercise')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          name: 'Fast Outdoor Run',
          category: ExerciseCategory.RUNNING,
          durationMinutes: 45,
          intensity: ExerciseIntensity.VIGOROUS,
          estimateCalories: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calorieSource).toBe(CalorieEstimateSource.MET_FORMULA);
      expect(res.body.data.caloriesBurned).toBeGreaterThan(600);
      expect(res.body.data.metValue).toBe(12);
    });

    it('retrieves exercise activity list with query filtering', async () => {
      const res = await request(app)
        .get('/api/v1/tracking/exercise')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('updates an exercise activity', async () => {
      const res = await request(app)
        .patch(`/api/v1/tracking/exercise/${exerciseId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .send({
          durationMinutes: 35,
          caloriesBurned: 360,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.durationMinutes).toBe(35);
      expect(res.body.data.caloriesBurned).toBe(360);
    });

    it('enforces multi-tenant isolation on exercise delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/tracking/exercise/${exerciseId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(res.status).toBe(404);
    });

    it('deletes an exercise activity', async () => {
      const res = await request(app)
        .delete(`/api/v1/tracking/exercise/${exerciseId}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================================
  // 4. PROGRESS REPORT
  // ============================================================================
  describe('Progress Report Aggregation', () => {
    it('generates complete multi-metric progress report with non-diet-credit disclaimer', async () => {
      const res = await request(app)
        .get('/api/v1/tracking/progress')
        .set('Authorization', `Bearer ${TOKEN_USER_A}`)
        .query({
          days: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const report = res.body.data;

      // Weight section
      expect(report.weight).toBeDefined();
      expect(report.weight.currentWeightKg).toBe(81.0);

      // Water section
      expect(report.water).toBeDefined();
      expect(report.water.targetMl).toBe(2800);
      expect(report.water.daysTracked).toBeGreaterThanOrEqual(1);

      // Exercise section
      expect(report.exercise).toBeDefined();
      expect(report.exercise.totalSessions).toBeGreaterThanOrEqual(1);
      expect(report.exercise.totalCaloriesBurned).toBeGreaterThan(0);
      expect(report.exercise.sessionsByCategory).toHaveProperty(ExerciseCategory.RUNNING);

      // Disclaimers
      expect(report.disclaimers).toBeInstanceOf(Array);
      expect(
        report.disclaimers.some((d: string) => d.includes('NOT added to your food calorie budget')),
      ).toBe(true);
    });
  });
});
