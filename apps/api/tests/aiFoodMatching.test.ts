import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FoodMatchingService } from '../src/services/foodMatching.service.js';
import { seedFoodDatabase } from '../src/services/foodSeed.service.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import { RecognizedFoodItem } from '../src/ai/types.js';

describe('Structured Food Matching Engine', () => {
  let prisma: PrismaClient;
  let matchingService: FoodMatchingService;
  let testUserIdA: string;
  let testUserIdB: string;
  let customFoodIdA: string;

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    validateTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    // Ensure reference seed data is loaded
    await seedFoodDatabase(prisma);

    matchingService = new FoodMatchingService(prisma);

    // Create two test users
    const userA = await prisma.user.upsert({
      where: { email: 'user.matching.a@calmeter.app' },
      update: {},
      create: {
        firebaseUid: 'firebase-user-match-a',
        email: 'user.matching.a@calmeter.app',
        name: 'User Matching A',
      },
    });
    testUserIdA = userA.id;

    const userB = await prisma.user.upsert({
      where: { email: 'user.matching.b@calmeter.app' },
      update: {},
      create: {
        firebaseUid: 'firebase-user-match-b',
        email: 'user.matching.b@calmeter.app',
        name: 'User Matching B',
      },
    });
    testUserIdB = userB.id;

    // Create a private custom food for User A
    const customFood = await prisma.foodItem.create({
      data: {
        name: 'User A Secret Grandma Dhokla',
        localNames: ['Khaman Dhokla Secret'],
        isCustom: true,
        isVerified: false,
        createdByUserId: testUserIdA,
        calories: 140,
        protein: 4.5,
        carbs: 22,
        fat: 3.5,
        servingSize: 100,
        servingUnit: 'piece',
      },
    });
    customFoodIdA = customFood.id;
  });

  afterAll(async () => {
    if (customFoodIdA) {
      await prisma.foodItem.deleteMany({ where: { id: customFoodIdA } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: ['user.matching.a@calmeter.app', 'user.matching.b@calmeter.app'] } },
    });
    await prisma.$disconnect();
  });

  it('identifies exact canonical name match with score 1.0', async () => {
    const item: RecognizedFoodItem = {
      id: 'cand-1',
      name: 'Whole Wheat Roti / Phulka',
      alternateNames: [],
      category: 'bread',
      portion: { quantity: 1, unit: 'piece', estimatedGrams: 35, confidence: 0.9 },
      confidenceScore: 0.95,
      components: [],
    };

    const match = await matchingService.matchSingleItem(item);

    expect(match.matchStatus).toBe('EXACT_MATCH');
    expect(match.primaryMatch).not.toBeNull();
    expect(match.primaryMatch?.name).toBe('Whole Wheat Roti / Phulka');
    expect(match.primaryMatch?.score).toBe(1.0);
    expect(match.primaryMatch?.isVerified).toBe(true);
  });

  it('identifies regional alias match (phulka -> Whole Wheat Roti / Phulka)', async () => {
    const item: RecognizedFoodItem = {
      id: 'cand-alias',
      name: 'Phulka',
      alternateNames: ['Chapati'],
      category: 'bread',
      portion: { quantity: 2, unit: 'piece', estimatedGrams: 70, confidence: 0.9 },
      confidenceScore: 0.92,
      components: [],
    };

    const match = await matchingService.matchSingleItem(item);

    expect(['EXACT_MATCH', 'HIGH_CONFIDENCE']).toContain(match.matchStatus);
    expect(match.primaryMatch).not.toBeNull();
    expect(match.primaryMatch?.name).toBe('Whole Wheat Roti / Phulka');
    expect(match.primaryMatch?.score).toBeGreaterThanOrEqual(0.95);
  });

  it('handles ambiguous query with multiple alternative candidate matches', async () => {
    // "Paneer" query matches both Paneer Butter Masala, Palak Paneer, Raw Paneer
    const item: RecognizedFoodItem = {
      id: 'cand-paneer',
      name: 'Paneer',
      alternateNames: ['Cottage Cheese'],
      category: 'curry',
      portion: { quantity: 1, unit: 'katori', estimatedGrams: 150, confidence: 0.7 },
      confidenceScore: 0.8,
      components: [],
    };

    const match = await matchingService.matchSingleItem(item);

    expect(match.primaryMatch).not.toBeNull();
    expect(match.alternativeMatches.length).toBeGreaterThan(0);
    expect(['AMBIGUOUS', 'HIGH_CONFIDENCE', 'LOW_CONFIDENCE']).toContain(match.matchStatus);
  });

  it('returns NO_MATCH for non-existent exotic food name', async () => {
    const item: RecognizedFoodItem = {
      id: 'cand-alien',
      name: 'Martian Crystallized Nebula Stew',
      alternateNames: [],
      category: 'soup',
      portion: { quantity: 1, unit: 'bowl', estimatedGrams: 200, confidence: 0.3 },
      confidenceScore: 0.2,
      components: [],
    };

    const match = await matchingService.matchSingleItem(item);

    expect(match.matchStatus).toBe('NO_MATCH');
    expect(match.primaryMatch).toBeNull();
    expect(match.alternativeMatches.length).toBe(0);
  });

  it('matches private custom food for its creator (User A)', async () => {
    const item: RecognizedFoodItem = {
      id: 'cand-custom',
      name: 'Secret Grandma Dhokla',
      alternateNames: [],
      category: 'snack',
      portion: { quantity: 2, unit: 'piece', estimatedGrams: 100, confidence: 0.9 },
      confidenceScore: 0.9,
      components: [],
    };

    // User A can see and match their own custom food
    const matchUserA = await matchingService.matchSingleItem(item, testUserIdA);

    expect(matchUserA.primaryMatch).not.toBeNull();
    expect(matchUserA.primaryMatch?.foodItemId).toBe(customFoodIdA);
    expect(matchUserA.primaryMatch?.isCustom).toBe(true);
  });

  it('strictly isolates private custom food so User B cannot match User A custom food', async () => {
    const item: RecognizedFoodItem = {
      id: 'cand-custom',
      name: 'User A Secret Grandma Dhokla',
      alternateNames: [],
      category: 'snack',
      portion: { quantity: 2, unit: 'piece', estimatedGrams: 100, confidence: 0.9 },
      confidenceScore: 0.9,
      components: [],
    };

    // User B cannot match User A's private food
    const matchUserB = await matchingService.matchSingleItem(item, testUserIdB);

    if (matchUserB.primaryMatch) {
      expect(matchUserB.primaryMatch.foodItemId).not.toBe(customFoodIdA);
    }
  });
});
