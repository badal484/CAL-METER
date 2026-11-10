import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import { seedFoodDatabase } from '../src/services/foodSeed.service.js';
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

describe('Food Diary & Daily Nutrition Tracking API', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_USER_A = 'token-diary-user-a';
  const TOKEN_USER_B = 'token-diary-user-b';

  let userAId: string;
  let userBId: string;
  let dalFoodId: string;
  let rotiFoodId: string;

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    // Seed food items if empty
    await seedFoodDatabase(prisma);

    // Setup Test Auth Verifier
    verifier = new TestAuthVerifier();
    verifier.register(TOKEN_USER_A, {
      uid: 'fb-diary-user-a',
      email: 'diary-a@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_USER_B, {
      uid: 'fb-diary-user-b',
      email: 'diary-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Create / ensure users in PostgreSQL
    const userA = await prisma.user.upsert({
      where: { firebaseUid: 'fb-diary-user-a' },
      update: {},
      create: {
        firebaseUid: 'fb-diary-user-a',
        email: 'diary-a@test.com',
        name: 'Diary User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-diary-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-diary-user-b',
        email: 'diary-b@test.com',
        name: 'Diary User B',
      },
    });
    userBId = userB.id;

    // Create NutritionGoal for User A
    await prisma.nutritionGoal.create({
      data: {
        userId: userAId,
        dailyCalories: 2100,
        proteinGrams: 140,
        carbsGrams: 220,
        fatGrams: 65,
        fiberGrams: 30,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    // Locate Dal Tadka and Roti from seed data
    const dalFood = await prisma.foodItem.findFirstOrThrow({
      where: { name: { contains: 'Dal Tadka' } },
    });
    dalFoodId = dalFood.id;

    const rotiFood = await prisma.foodItem.findFirstOrThrow({
      where: { name: { contains: 'Phulka' } },
    });
    rotiFoodId = rotiFood.id;

    // Clean up any old meals for test users
    await prisma.mealEntry.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    await prisma.mealEntry.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.nutritionGoal.deleteMany({
      where: { userId: userAId },
    });
    await prisma.$disconnect();
  });

  it('GET /api/v1/diary/:date returns empty structure when no meals are logged', async () => {
    const res = await request(app)
      .get('/api/v1/diary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.date).toBe('2026-11-10');
    expect(res.body.data.meals).toHaveLength(0);
    expect(res.body.data.totals.calories).toBe(0);
    expect(res.body.data.totals.protein).toBe(0);
  });

  it('POST /api/v1/diary/entries logs food items into Breakfast and computes deterministic nutrition', async () => {
    const res = await request(app)
      .post('/api/v1/diary/entries')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        date: '2026-11-10',
        mealType: 'BREAKFAST',
        notes: 'Healthy breakfast',
        items: [
          {
            foodItemId: rotiFoodId,
            foodName: 'Whole Wheat Roti / Phulka',
            portionAmount: 2,
            servingUnit: 'piece',
            loggedMethod: 'SEARCH',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const { mealEntry, createdItems } = res.body.data;

    expect(mealEntry.mealType).toBe('BREAKFAST');
    expect(createdItems).toHaveLength(1);
    const rotiItem = createdItems[0];
    expect(rotiItem.foodName).toBe('Whole Wheat Roti / Phulka');
    expect(rotiItem.portionAmount).toBe(2);
    expect(rotiItem.gramWeight).toBe(70); // 2 * 35g
    expect(rotiItem.calories).toBeGreaterThan(140);
    expect(rotiItem.protein).toBeGreaterThan(4);
    expect(rotiItem.loggedMethod).toBe('SEARCH');

    // Verify parent MealEntry totals reflect the item
    expect(mealEntry.totalCalories).toBe(rotiItem.calories);
    expect(mealEntry.totalProtein).toBe(rotiItem.protein);
  });

  it('POST /api/v1/diary/entries logs food items into Lunch with katori serving conversion', async () => {
    const res = await request(app)
      .post('/api/v1/diary/entries')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        date: '2026-11-10',
        mealType: 'LUNCH',
        items: [
          {
            foodItemId: dalFoodId,
            foodName: 'Yellow Dal Tadka',
            portionAmount: 1.5,
            servingUnit: 'katori',
            loggedMethod: 'SEARCH',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const { mealEntry, createdItems } = res.body.data;

    expect(mealEntry.mealType).toBe('LUNCH');
    const dalItem = createdItems[0];
    expect(dalItem.gramWeight).toBe(270); // 1.5 * 180g from seed data
    expect(dalItem.calories).toBeGreaterThan(200);
    expect(mealEntry.totalCalories).toBe(dalItem.calories);
  });

  it('GET /api/v1/diary/summary/:date derives daily summary against goals', async () => {
    const res = await request(app)
      .get('/api/v1/diary/summary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const summary = res.body.data;

    expect(summary.date).toBe('2026-11-10');
    expect(summary.calorieGoal).toBe(2100);
    expect(summary.caloriesConsumed).toBeGreaterThan(300);
    expect(summary.caloriesRemaining).toBe(Math.round((2100 - summary.caloriesConsumed) * 10) / 10);
    expect(summary.macros.protein.target).toBe(140);
    expect(summary.macros.protein.consumed).toBeGreaterThan(10);
    expect(summary.meals).toHaveLength(2); // BREAKFAST and LUNCH
  });

  it('Historical snapshot immutability: catalog update does not silently alter historical diary item', async () => {
    // Fetch user A's breakfast item
    const diaryRes = await request(app)
      .get('/api/v1/diary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);
    const breakfast = diaryRes.body.data.meals.find((m: any) => m.mealType === 'BREAKFAST');
    const loggedRoti = breakfast.items[0];
    const originalCalories = loggedRoti.calories;

    // Simulate an admin modifying the base food item's 100g calorie profile
    await prisma.foodItem.update({
      where: { id: rotiFoodId },
      data: { calories: 999.0 },
    });

    // Re-fetch diary entry
    const refetchRes = await request(app)
      .get(`/api/v1/diary/entries/${loggedRoti.id}`)
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);

    expect(refetchRes.status).toBe(200);
    // Historical logged item snapshot must preserve original calories!
    expect(refetchRes.body.data.calories).toBe(originalCalories);

    // Revert base food item modification
    await prisma.foodItem.update({
      where: { id: rotiFoodId },
      data: { calories: 240.0 },
    });
  });

  it('Strict multi-tenant security: User B receives 404 when attempting to access User A diary item', async () => {
    const diaryRes = await request(app)
      .get('/api/v1/diary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);
    const loggedItemId = diaryRes.body.data.meals[0].items[0].id;

    // User B attempts GET
    const getRes = await request(app)
      .get(`/api/v1/diary/entries/${loggedItemId}`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`);
    expect(getRes.status).toBe(404);

    // User B attempts PATCH
    const patchRes = await request(app)
      .patch(`/api/v1/diary/entries/${loggedItemId}`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`)
      .send({ portionAmount: 5 });
    expect(patchRes.status).toBe(404);

    // User B attempts DELETE
    const delRes = await request(app)
      .delete(`/api/v1/diary/entries/${loggedItemId}`)
      .set('Authorization', `Bearer ${TOKEN_USER_B}`);
    expect(delRes.status).toBe(404);
  });

  it('PATCH /api/v1/diary/entries/:id updates portion quantity and recalculates totals', async () => {
    const diaryRes = await request(app)
      .get('/api/v1/diary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);
    const breakfast = diaryRes.body.data.meals.find((m: any) => m.mealType === 'BREAKFAST');
    const loggedItem = breakfast.items[0];

    // Update portion from 2 pieces to 3 pieces
    const patchRes = await request(app)
      .patch(`/api/v1/diary/entries/${loggedItem.id}`)
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({ portionAmount: 3 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    const { updatedItem, mealEntry } = patchRes.body.data;

    expect(updatedItem.portionAmount).toBe(3);
    expect(updatedItem.gramWeight).toBe(105); // 3 * 35g
    expect(updatedItem.calories).toBeGreaterThan(loggedItem.calories);
    expect(mealEntry.totalCalories).toBe(updatedItem.calories);
  });

  it('DELETE /api/v1/diary/entries/:id removes item and recalculates meal totals', async () => {
    const diaryRes = await request(app)
      .get('/api/v1/diary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);
    const lunch = diaryRes.body.data.meals.find((m: any) => m.mealType === 'LUNCH');
    const lunchItem = lunch.items[0];

    const delRes = await request(app)
      .delete(`/api/v1/diary/entries/${lunchItem.id}`)
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify meal totals are now 0
    const checkRes = await request(app)
      .get('/api/v1/diary/2026-11-10')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);
    const updatedLunch = checkRes.body.data.meals.find((m: any) => m.mealType === 'LUNCH');
    expect(updatedLunch.items).toHaveLength(0);
    expect(updatedLunch.totalCalories).toBe(0);
  });

  it('Validation guards: rejects impossible dates and non-positive quantities', async () => {
    // Impossible date
    const badDateRes = await request(app)
      .get('/api/v1/diary/2026-02-30')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`);
    expect(badDateRes.status).toBe(400);

    // Negative quantity
    const badPortionRes = await request(app)
      .post('/api/v1/diary/entries')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        date: '2026-11-10',
        mealType: 'DINNER',
        items: [
          {
            foodItemId: dalFoodId,
            foodName: 'Yellow Dal',
            portionAmount: -2,
            servingUnit: 'katori',
          },
        ],
      });
    expect(badPortionRes.status).toBe(400);

    // Zero quantity
    const zeroPortionRes = await request(app)
      .post('/api/v1/diary/entries')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        date: '2026-11-10',
        mealType: 'DINNER',
        items: [
          {
            foodItemId: dalFoodId,
            foodName: 'Yellow Dal',
            portionAmount: 0,
            servingUnit: 'katori',
          },
        ],
      });
    expect(zeroPortionRes.status).toBe(400);
  });

  it('Manual / custom food entry without foodItemId logs directly with snapshot', async () => {
    const res = await request(app)
      .post('/api/v1/diary/entries')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        date: '2026-11-10',
        mealType: 'SNACK',
        items: [
          {
            foodName: 'Homemade Protein Smoothie',
            portionAmount: 1,
            servingUnit: 'glass',
            gramWeight: 350,
            calories: 280,
            protein: 25,
            carbs: 32,
            fat: 5,
            fiber: 6,
            sugar: 18,
            sodium: 120,
            loggedMethod: 'MANUAL_ENTRY',
          },
        ],
      });

    expect(res.status).toBe(201);
    const item = res.body.data.createdItems[0];
    expect(item.foodItemId).toBeNull();
    expect(item.foodName).toBe('Homemade Protein Smoothie');
    expect(item.calories).toBe(280);
    expect(item.protein).toBe(25);
    expect(item.fiber).toBe(6);
    expect(item.sugar).toBe(18);
    expect(item.sodium).toBe(120);
    expect(item.loggedMethod).toBe('MANUAL_ENTRY');
  });

  it('Transaction rollback: fails atomically if any item in a batch is invalid', async () => {
    const preCount = await prisma.mealFoodItem.count({
      where: { mealEntry: { userId: userAId } },
    });

    const res = await request(app)
      .post('/api/v1/diary/entries')
      .set('Authorization', `Bearer ${TOKEN_USER_A}`)
      .send({
        date: '2026-11-10',
        mealType: 'DINNER',
        items: [
          {
            foodItemId: dalFoodId,
            foodName: 'Valid Dal',
            portionAmount: 1,
            servingUnit: 'katori',
          },
          {
            foodItemId: '00000000-0000-0000-0000-000000000000', // Non-existent food
            foodName: 'Invalid Food',
            portionAmount: 1,
            servingUnit: 'portion',
          },
        ],
      });

    expect(res.status).toBe(404);
    const postCount = await prisma.mealFoodItem.count({
      where: { mealEntry: { userId: userAId } },
    });
    // No new items should have been persisted for user A!
    expect(postCount).toBe(preCount);

    const dinnerMeal = await prisma.mealEntry.findUnique({
      where: {
        userId_date_mealType: {
          userId: userAId,
          date: new Date('2026-11-10T00:00:00.000Z'),
          mealType: 'DINNER',
        },
      },
      include: { items: true },
    });
    expect(dinnerMeal?.items.length ?? 0).toBe(0);
  });
});
