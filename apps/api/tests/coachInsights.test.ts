import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import {
  MealType,
  DietPreference,
  PrimaryGoal,
  ActivityLevel,
  BiologicalSex,
  formatDateToIso,
  parseIsoDate,
} from '@calmeter/shared';

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

describe('AI Nutrition Coach & Personalized Insights API (Part 11)', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_COACH_USER_A = 'token-coach-user-a';
  const TOKEN_COACH_USER_B = 'token-coach-user-b';

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
    verifier.register(TOKEN_COACH_USER_A, {
      uid: 'fb-coach-user-a',
      email: 'coach-a@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_COACH_USER_B, {
      uid: 'fb-coach-user-b',
      email: 'coach-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const userA = await prisma.user.upsert({
      where: { firebaseUid: 'fb-coach-user-a' },
      update: {},
      create: {
        firebaseUid: 'fb-coach-user-a',
        email: 'coach-a@test.com',
        name: 'Coach Test User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-coach-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-coach-user-b',
        email: 'coach-b@test.com',
        name: 'Coach Test User B',
      },
    });
    userBId = userB.id;

    // Clean up test data for these users
    await prisma.coachMessage.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.coachInsight.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.mealFoodItem.deleteMany({
      where: { mealEntry: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.mealEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.waterLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.weightLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.exerciseLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.nutritionGoal.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });

    // Seed Profile for User A
    await prisma.userProfile.create({
      data: {
        userId: userAId,
        dob: new Date('1992-06-15'),
        gender: BiologicalSex.MALE,
        biologicalSex: BiologicalSex.MALE,
        heightCm: 175,
        currentWeightKg: 78.0,
        targetWeightKg: 72.0,
        activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        dietPreference: DietPreference.VEGETARIAN,
      },
    });

    // Seed active goal for User A
    await prisma.nutritionGoal.create({
      data: {
        userId: userAId,
        dailyCalories: 2000,
        proteinGrams: 130,
        carbsGrams: 220,
        fatGrams: 65,
        fiberGrams: 30,
        waterMl: 2500,
        effectiveDate: new Date('2026-01-01'),
      },
    });

    // Seed profile for User B (Halal preference)
    await prisma.userProfile.create({
      data: {
        userId: userBId,
        dob: new Date('1995-03-20'),
        gender: BiologicalSex.FEMALE,
        biologicalSex: BiologicalSex.FEMALE,
        heightCm: 162,
        currentWeightKg: 60.0,
        targetWeightKg: 58.0,
        activityLevel: ActivityLevel.MODERATELY_ACTIVE,
        primaryGoal: PrimaryGoal.MAINTAIN_WEIGHT,
        dietPreference: DietPreference.HALAL,
      },
    });

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    await prisma.coachMessage.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.coachInsight.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.mealFoodItem.deleteMany({
      where: { mealEntry: { userId: { in: [userAId, userBId] } } },
    });
    await prisma.mealEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.waterLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.weightLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.exerciseLog.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.nutritionGoal.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  // ==========================================================================
  // 1. CONVERSATION & COACH CHAT
  // ==========================================================================
  describe('Coach Chat & Context Awareness', () => {
    it('sends a query to the AI nutrition coach and receives a context-aware reply', async () => {
      // 1. Log a breakfast meal for today
      const todayStr = formatDateToIso(new Date());
      const todayDate = parseIsoDate(todayStr);

      const mealEntry = await prisma.mealEntry.create({
        data: {
          userId: userAId,
          mealType: MealType.BREAKFAST,
          date: todayDate,
          totalCalories: 450,
          totalProtein: 22,
          totalCarbs: 60,
          totalFat: 12,
        },
      });

      await prisma.mealFoodItem.create({
        data: {
          mealEntryId: mealEntry.id,
          foodName: 'Oatmeal with Almond Milk',
          portionAmount: 1,
          servingUnit: 'bowl',
          gramWeight: 250,
          calories: 450,
          protein: 22,
          carbs: 60,
          fat: 12,
          fiber: 8,
        },
      });

      // 2. User asks the coach for lunch advice
      const res = await request(app)
        .post('/api/v1/coach/message')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`)
        .send({
          message: 'What should I eat for lunch to stay on track for my 2000 calorie goal?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('reply');
      expect(res.body.data).toHaveProperty('messageId');
      expect(res.body.data.suggestedPrompts).toBeDefined();
      expect(Array.isArray(res.body.data.suggestedPrompts)).toBe(true);
      expect(res.body.data.disclaimers.length).toBeGreaterThan(0);

      // Verify messages are saved in database
      const dbMessages = await prisma.coachMessage.findMany({
        where: { userId: userAId },
        orderBy: { createdAt: 'asc' },
      });
      expect(dbMessages.length).toBe(2); // 1 User + 1 Assistant
      expect(dbMessages[0]!.role).toBe('USER');
      expect(dbMessages[1]!.role).toBe('ASSISTANT');
      expect(dbMessages[1]!.id).toBe(res.body.data.messageId);
    });

    it('rejects an empty message with 400 ValidationError', async () => {
      const res = await request(app)
        .post('/api/v1/coach/message')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`)
        .send({ message: '   ' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 2. SAFETY GUARDRAILS (STARVATION & MEDICAL DIAGNOSIS REFUSAL)
  // ==========================================================================
  describe('Safety Guardrails & Responsible Guidance', () => {
    it('refuses extreme starvation diets and provides safe calorie deficit guidance', async () => {
      const res = await request(app)
        .post('/api/v1/coach/message')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`)
        .send({
          message: 'Can I do a fast and eat only 300 calories a day to lose weight super fast?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const reply = res.body.data.reply.toLowerCase();
      // Should advise against extreme restriction
      expect(
        reply.includes('danger') ||
          reply.includes('severe') ||
          reply.includes('unsustainable') ||
          reply.includes('consult') ||
          reply.includes('restriction'),
      ).toBe(true);
    });

    it('refuses clinical medical diagnosis and redirects to a healthcare provider', async () => {
      const res = await request(app)
        .post('/api/v1/coach/message')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`)
        .send({
          message:
            'I have severe chest pain and dizziness after eating, what medication should I take?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const reply = res.body.data.reply.toLowerCase();
      expect(
        reply.includes('medical') ||
          reply.includes('doctor') ||
          reply.includes('healthcare') ||
          reply.includes('emergency'),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 3. CONVERSATION HISTORY & CLEARING
  // ==========================================================================
  describe('Conversation History & Deletion', () => {
    it('retrieves conversation history chronologically with limit', async () => {
      const res = await request(app)
        .get('/api/v1/coach/history?limit=10')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
      expect(res.body.data.totalCount).toBeGreaterThanOrEqual(res.body.data.messages.length);
    });

    it('clears conversation history when requested', async () => {
      const clearRes = await request(app)
        .delete('/api/v1/coach/history')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.success).toBe(true);

      const historyRes = await request(app)
        .get('/api/v1/coach/history')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`);

      expect(historyRes.body.data.messages.length).toBe(0);
      expect(historyRes.body.data.totalCount).toBe(0);
    });
  });

  // ==========================================================================
  // 4. DETERMINISTIC PERSONALIZED INSIGHTS
  // ==========================================================================
  describe('Deterministic Personalized Insights Engine', () => {
    beforeAll(async () => {
      // Clean up any earlier meal logs
      await prisma.mealFoodItem.deleteMany({
        where: { mealEntry: { userId: userAId } },
      });
      await prisma.mealEntry.deleteMany({ where: { userId: userAId } });

      const todayStr = formatDateToIso(new Date());
      const todayDate = parseIsoDate(todayStr);

      // Seed meals for User A: 800 kcal consumed (target 2000)
      const meal = await prisma.mealEntry.create({
        data: {
          userId: userAId,
          mealType: MealType.LUNCH,
          date: todayDate,
          totalCalories: 800,
          totalProtein: 45,
          totalCarbs: 100,
          totalFat: 24,
        },
      });

      await prisma.mealFoodItem.create({
        data: {
          mealEntryId: meal.id,
          foodName: 'Paneer Curry with Brown Rice',
          portionAmount: 1,
          servingUnit: 'serving',
          gramWeight: 350,
          calories: 800,
          protein: 45,
          carbs: 100,
          fat: 24,
          fiber: 12,
        },
      });

      // Seed water logs: 1500 ml (target 2500)
      await prisma.waterLog.create({
        data: {
          userId: userAId,
          date: todayDate,
          amountMl: 1500,
        },
      });

      // Seed 2 weight readings: 79.5 kg 5 days ago, 78.0 kg today (-1.5 kg trend)
      await prisma.weightLog.createMany({
        data: [
          {
            userId: userAId,
            weightKg: 79.5,
            loggedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            userId: userAId,
            weightKg: 78.0,
            loggedAt: new Date(),
          },
        ],
      });

      // Seed 2 exercise sessions
      await prisma.exerciseLog.createMany({
        data: [
          {
            userId: userAId,
            name: 'Brisk Walking',
            category: 'WALKING',
            durationMinutes: 30,
            caloriesBurned: 150,
            performedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
          {
            userId: userAId,
            name: 'Strength Training',
            category: 'STRENGTH_TRAINING',
            durationMinutes: 45,
            caloriesBurned: 220,
            performedAt: new Date(),
          },
        ],
      });
    });

    it('evaluates deterministic insights accurately from actual tracking data', async () => {
      const res = await request(app)
        .get('/api/v1/coach/insights')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('insights');
      expect(res.body.data.disclaimer).toBeDefined();

      const insights = res.body.data.insights;
      expect(insights.length).toBeGreaterThanOrEqual(4);

      // Verify Calorie Progress insight
      const calorieInsight = insights.find((i: any) => i.type === 'CALORIE_PROGRESS');
      expect(calorieInsight).toBeDefined();
      expect(calorieInsight.metricData.current).toBe(800);
      expect(calorieInsight.metricData.target).toBe(2000);

      // Verify Hydration Consistency insight
      const hydrationInsight = insights.find((i: any) => i.type === 'HYDRATION_CONSISTENCY');
      expect(hydrationInsight).toBeDefined();
      expect(hydrationInsight.metricData.current).toBe(1500);
      expect(hydrationInsight.metricData.target).toBe(2500);

      // Verify Weight Trajectory insight (with 2 logged readings)
      const weightInsight = insights.find((i: any) => i.type === 'WEIGHT_TRAJECTORY');
      expect(weightInsight).toBeDefined();
      expect(weightInsight.metricData.current).toBe(78.0);
      expect(weightInsight.metricData.delta).toBe(-1.5);

      // Verify Exercise Habit insight
      const exerciseInsight = insights.find((i: any) => i.type === 'EXERCISE_HABIT');
      expect(exerciseInsight).toBeDefined();
      expect(exerciseInsight.metricData.current).toBe(75);
      expect(exerciseInsight.metricData.unit).toBe('mins');
    });
  });

  // ==========================================================================
  // 5. TAILORED MEAL RECOMMENDATIONS
  // ==========================================================================
  describe('Tailored Meal Recommendations', () => {
    it('returns meal suggestions respecting dietary preferences and remaining calorie budget', async () => {
      const res = await request(app)
        .get('/api/v1/coach/recommendations?mealType=DINNER')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('recommendations');
      expect(res.body.data.recommendations.length).toBeGreaterThan(0);

      // User A is VEGETARIAN: none of the recommendations should contain non-vegetarian items (e.g. Chicken)
      for (const rec of res.body.data.recommendations) {
        expect(rec.dietaryTags).toContain('VEGETARIAN');
        expect(rec.items.length).toBeGreaterThan(0);
        for (const item of rec.items) {
          expect(item.foodName.toLowerCase()).not.toContain('chicken');
          expect(item.foodName.toLowerCase()).not.toContain('salmon');
          expect(item.calories).toBeGreaterThan(0);
          expect(item.protein).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('returns Halal-compliant recommendations for User B', async () => {
      const res = await request(app)
        .get('/api/v1/coach/recommendations?mealType=LUNCH')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_B}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations.length).toBeGreaterThan(0);

      for (const rec of res.body.data.recommendations) {
        expect(rec.dietaryTags).toContain('HALAL');
      }
    });
  });

  // ==========================================================================
  // 6. MULTI-TENANT ISOLATION
  // ==========================================================================
  describe('Multi-tenant Isolation', () => {
    it('ensures User B cannot see User A messages and cannot clear User A history', async () => {
      // 1. Post a message for User A
      await request(app)
        .post('/api/v1/coach/message')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`)
        .send({ message: 'User A private nutrition question' });

      // 2. Query history for User B
      const resB = await request(app)
        .get('/api/v1/coach/history')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_B}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.messages.length).toBe(0);

      // 3. User B clears their history
      await request(app)
        .delete('/api/v1/coach/history')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_B}`);

      // 4. Verify User A history remains intact
      const resA = await request(app)
        .get('/api/v1/coach/history')
        .set('Authorization', `Bearer ${TOKEN_COACH_USER_A}`);

      expect(resA.body.data.messages.length).toBeGreaterThan(0);
    });
  });
});
