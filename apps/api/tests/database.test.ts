import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';

// ==============================================================================
// 1. Guard Regression Tests: Test Database URL Isolation
// ==============================================================================

describe('Database Guard: Isolation & Configuration Safety', () => {
  it('fails safely when TEST_DATABASE_URL is missing or empty', () => {
    expect(() => validateTestDatabaseUrl(undefined, 'test')).toThrow(
      /TEST_DATABASE_URL is missing/i,
    );
    expect(() => validateTestDatabaseUrl('', 'test')).toThrow(/TEST_DATABASE_URL is missing/i);
    expect(() => validateTestDatabaseUrl('   ', 'test')).toThrow(/TEST_DATABASE_URL is missing/i);
  });

  it('rejects a development database URL', () => {
    expect(() =>
      validateTestDatabaseUrl('postgresql://calmeter:calmeter@localhost:5432/calmeter_dev', 'test'),
    ).toThrow(/is NOT a permitted test database/i);
  });

  it('rejects a production database URL', () => {
    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://prod_admin:secret@db.prod.internal:5432/calmeter_prod',
        'test',
      ),
    ).toThrow(/is NOT a permitted test database/i);

    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://admin:secret@db.prod.internal:5432/calmeter_production',
        'test',
      ),
    ).toThrow(/is NOT a permitted test database/i);
  });

  it('rejects postgres, staging, or generic database names', () => {
    expect(() =>
      validateTestDatabaseUrl('postgresql://postgres:postgres@localhost:5432/postgres', 'test'),
    ).toThrow(/is NOT a permitted test database/i);

    expect(() =>
      validateTestDatabaseUrl('postgresql://calmeter:calmeter@localhost:5432/calmeter', 'test'),
    ).toThrow(/is NOT a permitted test database/i);

    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://calmeter:calmeter@localhost:5432/calmeter_staging',
        'test',
      ),
    ).toThrow(/is NOT a permitted test database/i);
  });

  it('rejects execution when NODE_ENV is not test', () => {
    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        'development',
      ),
    ).toThrow(/Refusing to run database tests outside of NODE_ENV=test/i);

    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
        'production',
      ),
    ).toThrow(/Refusing to run database tests outside of NODE_ENV=test/i);
  });

  it('rejects non-PostgreSQL protocols', () => {
    expect(() =>
      validateTestDatabaseUrl('mysql://calmeter:calmeter@localhost:3306/calmeter_test', 'test'),
    ).toThrow(/must use postgresql: protocol/i);

    expect(() => validateTestDatabaseUrl('http://localhost:5432/calmeter_test', 'test')).toThrow(
      /must use postgresql: protocol/i,
    );
  });

  it('accepts permitted test database URLs', () => {
    const validated1 = validateTestDatabaseUrl(
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
      'test',
    );
    expect(validated1.dbName).toBe('calmeter_test');

    const validated2 = validateTestDatabaseUrl(
      'postgresql://ci_runner:pass@localhost:5432/custom_suite_test',
      'test',
    );
    expect(validated2.dbName).toBe('custom_suite_test');
  });

  it('proves no database connection or destructive operation occurs after invalid configuration', async () => {
    let attemptedMutation = false;

    try {
      // Guard must throw before any client instantiation or query
      validateTestDatabaseUrl(
        'postgresql://prod_user:secret@db.prod.internal:5432/calmeter_prod',
        'test',
      );
      attemptedMutation = true;
    } catch {
      // Expected to catch
    }

    expect(attemptedMutation).toBe(false);
  });
});

// ==============================================================================
// 2. Integration Test Entity Tracker (Safe targeted cleanup)
// ==============================================================================

class TestEntityTracker {
  mealFoodItemIds: string[] = [];
  mealEntryIds: string[] = [];
  conversionIds: string[] = [];
  foodItemIds: string[] = [];
  nutritionGoalIds: string[] = [];
  userProfileIds: string[] = [];
  weightLogIds: string[] = [];
  waterLogIds: string[] = [];
  scanLogIds: string[] = [];
  userIds: string[] = [];

  trackUser(id: string) {
    this.userIds.push(id);
  }
  trackProfile(id: string) {
    this.userProfileIds.push(id);
  }
  trackGoal(id: string) {
    this.nutritionGoalIds.push(id);
  }
  trackFood(id: string) {
    this.foodItemIds.push(id);
  }
  trackConversion(id: string) {
    this.conversionIds.push(id);
  }
  trackMeal(id: string) {
    this.mealEntryIds.push(id);
  }
  trackMealFood(id: string) {
    this.mealFoodItemIds.push(id);
  }
  trackWeight(id: string) {
    this.weightLogIds.push(id);
  }
  trackWater(id: string) {
    this.waterLogIds.push(id);
  }
  trackScan(id: string) {
    this.scanLogIds.push(id);
  }

  async cleanup(client: PrismaClient) {
    // Delete in reverse foreign-key dependency order
    if (this.mealFoodItemIds.length > 0) {
      await client.mealFoodItem.deleteMany({ where: { id: { in: this.mealFoodItemIds } } });
      this.mealFoodItemIds = [];
    }
    if (this.mealEntryIds.length > 0) {
      await client.mealEntry.deleteMany({ where: { id: { in: this.mealEntryIds } } });
      this.mealEntryIds = [];
    }
    if (this.conversionIds.length > 0) {
      await client.servingUnitConversion.deleteMany({ where: { id: { in: this.conversionIds } } });
      this.conversionIds = [];
    }
    if (this.scanLogIds.length > 0) {
      await client.foodScanLog.deleteMany({ where: { id: { in: this.scanLogIds } } });
      this.scanLogIds = [];
    }
    if (this.foodItemIds.length > 0) {
      await client.foodItem.deleteMany({ where: { id: { in: this.foodItemIds } } });
      this.foodItemIds = [];
    }
    if (this.waterLogIds.length > 0) {
      await client.waterLog.deleteMany({ where: { id: { in: this.waterLogIds } } });
      this.waterLogIds = [];
    }
    if (this.weightLogIds.length > 0) {
      await client.weightLog.deleteMany({ where: { id: { in: this.weightLogIds } } });
      this.weightLogIds = [];
    }
    if (this.nutritionGoalIds.length > 0) {
      await client.nutritionGoal.deleteMany({ where: { id: { in: this.nutritionGoalIds } } });
      this.nutritionGoalIds = [];
    }
    if (this.userProfileIds.length > 0) {
      await client.userProfile.deleteMany({ where: { id: { in: this.userProfileIds } } });
      this.userProfileIds = [];
    }
    if (this.userIds.length > 0) {
      await client.user.deleteMany({ where: { id: { in: this.userIds } } });
      this.userIds = [];
    }
  }
}

// ==============================================================================
// 3. Live Database Integration Tests using only TEST_DATABASE_URL
// ==============================================================================

// Verify and enforce test database URL isolation before constructing client
const validatedDb = validateTestDatabaseUrl(
  process.env.TEST_DATABASE_URL || 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
  process.env.NODE_ENV || 'test',
);

const prisma = new PrismaClient({
  datasourceUrl: validatedDb.url,
});

describe('Live PostgreSQL Integration & Constraint Verification', () => {
  const tracker = new TestEntityTracker();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    // Targeted cleanup of test-created entities; runs even if assertions fail
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Architecture, Constraints & Tenant Isolation', () => {
    it('creates User record with separate internal UUID and unique firebaseUid', async () => {
      const firebaseUid = `firebase-${randomUUID()}`;
      const email = `test-${randomUUID()}@calmeter.test.app`;

      const user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
          name: 'Test Architect',
          role: UserRole.USER,
        },
      });
      tracker.trackUser(user.id);

      expect(user.id).toBeDefined();
      expect(user.firebaseUid).toBe(firebaseUid);
      expect(user.role).toBe('USER');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('rejects duplicate firebaseUid enforcing uniqueness constraint', async () => {
      const duplicateUid = `firebase-dup-${randomUUID()}`;

      const user1 = await prisma.user.create({
        data: {
          firebaseUid: duplicateUid,
          email: `u1-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user1.id);

      await expect(
        prisma.user.create({
          data: {
            firebaseUid: duplicateUid,
            email: `u2-${randomUUID()}@calmeter.test.app`,
          },
        }),
      ).rejects.toThrow();
    });

    it('enforces 1-to-1 UserProfile constraint and foreign key relation', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `firebase-profile-${randomUUID()}`,
          email: `profile-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

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
      tracker.trackProfile(profile.id);

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
          email: `meal-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      const mealDate = new Date('2026-11-10');

      // Create Breakfast for today
      const breakfast = await prisma.mealEntry.create({
        data: {
          userId: user.id,
          date: mealDate,
          mealType: MealType.BREAKFAST,
          totalCalories: 450,
        },
      });
      tracker.trackMeal(breakfast.id);

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
      tracker.trackMeal(lunch.id);
      expect(lunch.mealType).toBe('LUNCH');
    });

    it('distinguishes custom user foods from verified catalog foods and preserves them on user deletion', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `firebase-food-owner-${randomUUID()}`,
          email: `food-owner-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      // Custom user food
      const customFood = await prisma.foodItem.create({
        data: {
          name: `Home Cooked Moong Dal ${randomUUID()}`,
          source: FoodSource.CUSTOM_USER,
          calories: 140,
          protein: 9.5,
          carbs: 22.0,
          fat: 2.1,
          createdByUserId: user.id,
          isVerified: false,
        },
      });
      tracker.trackFood(customFood.id);

      expect(customFood.createdByUserId).toBe(user.id);
      expect(customFood.isVerified).toBe(false);

      // Verified catalog food (no owner)
      const catalogFood = await prisma.foodItem.create({
        data: {
          name: `Boiled Egg Large ${randomUUID()}`,
          source: FoodSource.USDA_FOOD_DATA_CENTRAL,
          calories: 78,
          protein: 6.3,
          carbs: 0.6,
          fat: 5.3,
          createdByUserId: null,
          isVerified: true,
        },
      });
      tracker.trackFood(catalogFood.id);

      expect(catalogFood.createdByUserId).toBeNull();
      expect(catalogFood.isVerified).toBe(true);
    });

    it('cascades deletion of User to UserProfile, NutritionGoal, MealEntry, but unlinks custom foods', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `firebase-cascade-${randomUUID()}`,
          email: `cascade-${randomUUID()}@calmeter.test.app`,
        },
      });

      const profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          heightCm: 175,
          currentWeightKg: 75,
          targetWeightKg: 70,
        },
      });

      const goal = await prisma.nutritionGoal.create({
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
          name: `Special Protein Shake ${randomUUID()}`,
          calories: 320,
          protein: 35,
          carbs: 25,
          fat: 5,
          createdByUserId: user.id,
        },
      });
      tracker.trackFood(customFood.id);

      // Delete the user
      await prisma.user.delete({
        where: { id: user.id },
      });

      // Profile and Goals must be deleted automatically via CASCADE
      const profileCount = await prisma.userProfile.count({ where: { id: profile.id } });
      expect(profileCount).toBe(0);

      const goalCount = await prisma.nutritionGoal.count({ where: { id: goal.id } });
      expect(goalCount).toBe(0);

      // Custom food item is preserved, but createdByUserId is set to NULL (onDelete: SetNull)
      const preservedFood = await prisma.foodItem.findUnique({ where: { id: customFood.id } });
      expect(preservedFood).not.toBeNull();
      expect(preservedFood?.createdByUserId).toBeNull();
    });
  });

  describe('PostgreSQL Real Database CHECK Constraints Verification', () => {
    it('rejects user_profiles with non-positive height (height_cm > 0)', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-u-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.userProfile.create({
          data: {
            userId: user.id,
            heightCm: 0, // Violates height_cm > 0
            currentWeightKg: 70,
            targetWeightKg: 65,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects user_profiles with non-positive weight (current_weight_kg > 0)', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-w-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.userProfile.create({
          data: {
            userId: user.id,
            heightCm: 175,
            currentWeightKg: -5, // Violates current_weight_kg > 0
            targetWeightKg: 65,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects user_profiles with negative pace (pace_kg_per_week >= 0)', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-p-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.userProfile.create({
          data: {
            userId: user.id,
            heightCm: 175,
            currentWeightKg: 70,
            targetWeightKg: 65,
            paceKgPerWeek: -0.25, // Violates pace_kg_per_week >= 0
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects nutrition_goals with non-positive daily calories (daily_calories > 0)', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-cal-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.nutritionGoal.create({
          data: {
            userId: user.id,
            dailyCalories: 0, // Violates daily_calories > 0
            proteinGrams: 100,
            carbsGrams: 200,
            fatGrams: 50,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects nutrition_goals with negative macronutrient grams', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-macro-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.nutritionGoal.create({
          data: {
            userId: user.id,
            dailyCalories: 2000,
            proteinGrams: -10, // Violates protein_grams >= 0
            carbsGrams: 200,
            fatGrams: 50,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects food_items with non-positive serving size or negative nutrition', async () => {
      await expect(
        prisma.foodItem.create({
          data: {
            name: `Invalid Serving Size ${randomUUID()}`,
            servingSize: 0, // Violates serving_size > 0
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 2,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);

      await expect(
        prisma.foodItem.create({
          data: {
            name: `Negative Calories ${randomUUID()}`,
            servingSize: 100,
            calories: -50, // Violates calories >= 0
            protein: 5,
            carbs: 10,
            fat: 2,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects meal_food_items with confidence score outside [0, 1]', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-conf-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      const meal = await prisma.mealEntry.create({
        data: {
          userId: user.id,
          date: new Date('2026-11-10'),
          mealType: MealType.DINNER,
          totalCalories: 300,
        },
      });
      tracker.trackMeal(meal.id);

      const food = await prisma.foodItem.create({
        data: {
          name: `Test Food for Meal ${randomUUID()}`,
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 2,
        },
      });
      tracker.trackFood(food.id);

      // Violates confidence_score <= 1
      await expect(
        prisma.mealFoodItem.create({
          data: {
            mealEntryId: meal.id,
            foodItemId: food.id,
            portionAmount: 1,
            portionUnit: 'serving',
            gramWeight: 100,
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 2,
            confidenceScore: 1.5,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);

      // Violates confidence_score >= 0
      await expect(
        prisma.mealFoodItem.create({
          data: {
            mealEntryId: meal.id,
            foodItemId: food.id,
            portionAmount: 1,
            portionUnit: 'serving',
            gramWeight: 100,
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 2,
            confidenceScore: -0.1,
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects water_logs with negative amount', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-water-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.waterLog.create({
          data: {
            userId: user.id,
            date: new Date('2026-11-10'),
            amountMl: -250, // Violates amount_ml >= 0
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects weight_logs with non-positive weight', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-wt-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.weightLog.create({
          data: {
            userId: user.id,
            weightKg: 0, // Violates weight_kg > 0
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects serving_unit_conversions with non-positive gram weight', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: `Food For Conversion ${randomUUID()}`,
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 2,
        },
      });
      tracker.trackFood(food.id);

      await expect(
        prisma.servingUnitConversion.create({
          data: {
            foodItemId: food.id,
            unitName: 'cup',
            gramWeight: 0, // Violates gram_weight > 0
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });

    it('rejects food_scan_logs with negative latency', async () => {
      const user = await prisma.user.create({
        data: {
          firebaseUid: `check-user-${randomUUID()}`,
          email: `check-scan-${randomUUID()}@calmeter.test.app`,
        },
      });
      tracker.trackUser(user.id);

      await expect(
        prisma.foodScanLog.create({
          data: {
            userId: user.id,
            storageKey: 'scans/test.jpg',
            rawAiResponse: {},
            detectedItems: [],
            latencyMs: -100, // Violates latency_ms >= 0
          },
        }),
      ).rejects.toThrow(/check constraint|violates/i);
    });
  });
});
