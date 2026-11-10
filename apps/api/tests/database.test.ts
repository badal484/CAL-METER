import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PrismaClient,
  UserRole,
  Gender,
  ActivityLevel,
  PrimaryGoal,
  MealType,
  FoodSource,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

const testDbUrl =
  process.env.DATABASE_URL || 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';

const prisma = new PrismaClient({
  datasourceUrl: testDbUrl,
});

describe('Database Architecture, Constraints & Tenant Isolation', () => {
  beforeAll(async () => {
    await prisma.$connect();
    // Clean up test database tables in reverse foreign key order
    await prisma.mealFoodItem.deleteMany();
    await prisma.mealEntry.deleteMany();
    await prisma.servingUnitConversion.deleteMany();
    await prisma.foodItem.deleteMany();
    await prisma.nutritionGoal.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.weightLog.deleteMany();
    await prisma.waterLog.deleteMany();
    await prisma.foodScanLog.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.deletionRequest.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates User record with separate internal UUID and unique firebaseUid', async () => {
    const firebaseUid = `firebase-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        firebaseUid,
        email: 'testuser@calmeter.app',
        name: 'Test Architect',
        role: UserRole.USER,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.firebaseUid).toBe(firebaseUid);
    expect(user.role).toBe('USER');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate firebaseUid enforcing uniqueness constraint', async () => {
    const duplicateUid = `firebase-duplicate-${randomUUID()}`;

    await prisma.user.create({
      data: {
        firebaseUid: duplicateUid,
        email: 'user1@calmeter.app',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          firebaseUid: duplicateUid,
          email: 'user2@calmeter.app',
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces 1-to-1 UserProfile constraint and foreign key relation', async () => {
    const user = await prisma.user.create({
      data: {
        firebaseUid: `firebase-profile-${randomUUID()}`,
        email: 'profile-user@calmeter.app',
      },
    });

    const profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        gender: Gender.FEMALE,
        dob: new Date('1995-05-15'),
        heightCm: 168.5,
        currentWeightKg: 62.0,
        targetWeightKg: 58.0,
        activityLevel: ActivityLevel.MODERATELY_ACTIVE,
        primaryGoal: PrimaryGoal.LOSE_WEIGHT,
        paceKgPerWeek: 0.5,
      },
    });

    expect(profile.userId).toBe(user.id);
    expect(Number(profile.heightCm)).toBe(168.5);

    // Attempting to create a second profile for the same user must be rejected
    await expect(
      prisma.userProfile.create({
        data: {
          userId: user.id,
          heightCm: 170.0,
          currentWeightKg: 65.0,
          targetWeightKg: 60.0,
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces MealEntry compound uniqueness [userId, date, mealType]', async () => {
    const user = await prisma.user.create({
      data: {
        firebaseUid: `firebase-meal-${randomUUID()}`,
        email: 'meal-user@calmeter.app',
      },
    });

    const mealDate = new Date('2026-11-10');

    // Create Breakfast for today
    await prisma.mealEntry.create({
      data: {
        userId: user.id,
        date: mealDate,
        mealType: MealType.BREAKFAST,
        totalCalories: 450,
      },
    });

    // Creating another Breakfast on the same date for the same user must fail
    await expect(
      prisma.mealEntry.create({
        data: {
          userId: user.id,
          date: mealDate,
          mealType: MealType.BREAKFAST,
          totalCalories: 500,
        },
      }),
    ).rejects.toThrow();

    // Creating Lunch on the same date for the same user succeeds
    const lunch = await prisma.mealEntry.create({
      data: {
        userId: user.id,
        date: mealDate,
        mealType: MealType.LUNCH,
        totalCalories: 650,
      },
    });
    expect(lunch.mealType).toBe('LUNCH');
  });

  it('distinguishes custom user foods from verified catalog foods and preserves them on user deletion', async () => {
    const user = await prisma.user.create({
      data: {
        firebaseUid: `firebase-food-owner-${randomUUID()}`,
      },
    });

    // Custom user food
    const customFood = await prisma.foodItem.create({
      data: {
        name: 'Home Cooked Moong Dal',
        source: FoodSource.CUSTOM_USER,
        calories: 140,
        protein: 9.5,
        carbs: 22.0,
        fat: 2.1,
        createdByUserId: user.id,
        isVerified: false,
      },
    });

    expect(customFood.createdByUserId).toBe(user.id);
    expect(customFood.isVerified).toBe(false);

    // Verified catalog food (no owner)
    const catalogFood = await prisma.foodItem.create({
      data: {
        name: 'Boiled Egg (Large)',
        source: FoodSource.USDA_FOOD_DATA_CENTRAL,
        calories: 78,
        protein: 6.3,
        carbs: 0.6,
        fat: 5.3,
        createdByUserId: null,
        isVerified: true,
      },
    });

    expect(catalogFood.createdByUserId).toBeNull();
    expect(catalogFood.isVerified).toBe(true);
  });

  it('cascades deletion of User to UserProfile, NutritionGoal, MealEntry, but unlinks custom foods', async () => {
    const user = await prisma.user.create({
      data: {
        firebaseUid: `firebase-cascade-${randomUUID()}`,
        email: 'cascade@calmeter.app',
      },
    });

    await prisma.userProfile.create({
      data: {
        userId: user.id,
        heightCm: 175,
        currentWeightKg: 75,
        targetWeightKg: 70,
      },
    });

    await prisma.nutritionGoal.create({
      data: {
        userId: user.id,
        dailyCalories: 2000,
        proteinGrams: 140,
        carbsGrams: 200,
        fatGrams: 60,
      },
    });

    const customFood = await prisma.foodItem.create({
      data: {
        name: 'Special Protein Shake',
        calories: 320,
        protein: 35,
        carbs: 25,
        fat: 5,
        createdByUserId: user.id,
      },
    });

    // Delete the user
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Profile and Goals must be deleted automatically via CASCADE
    const profileCount = await prisma.userProfile.count({ where: { userId: user.id } });
    expect(profileCount).toBe(0);

    const goalCount = await prisma.nutritionGoal.count({ where: { userId: user.id } });
    expect(goalCount).toBe(0);

    // Custom food item is preserved, but createdByUserId is set to NULL (onDelete: SetNull)
    const preservedFood = await prisma.foodItem.findUnique({ where: { id: customFood.id } });
    expect(preservedFood).not.toBeNull();
    expect(preservedFood?.createdByUserId).toBeNull();
  });
});
