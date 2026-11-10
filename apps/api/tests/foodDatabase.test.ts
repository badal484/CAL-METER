import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import { FoodImportService } from '../src/importers/foodImport.service.js';
import { ReferenceIndianFoodAdapter } from '../src/importers/adapters/referenceIndianFood.adapter.js';
import { convertServingToGrams, scaleNutrients } from '@calmeter/shared';

describe('Food Database Layer: Real PostgreSQL Constraints & Integrity', () => {
  let prisma: PrismaClient;
  const createdFoodIds: string[] = [];

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    const nodeEnv = process.env.NODE_ENV || 'test';
    const validatedDb = validateTestDatabaseUrl(testDbUrl, nodeEnv);

    prisma = new PrismaClient({
      datasourceUrl: validatedDb.url,
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (createdFoodIds.length > 0) {
        await prisma.foodItem.deleteMany({
          where: { id: { in: createdFoodIds } },
        });
      }
      await prisma.$disconnect();
    }
  });

  describe('PostgreSQL Real Database CHECK Constraints Verification', () => {
    it('enforces non-negative calories constraint in food_nutrient_profiles', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: 'Negative Calorie Food Test',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
        },
      });
      createdFoodIds.push(food.id);

      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_nutrient_profiles" ("id", "food_item_id", "calories", "protein", "carbs", "fat", "created_at", "updated_at")
          VALUES (gen_random_uuid(), ${food.id}::uuid, -10.00, 5.00, 10.00, 2.00, NOW(), NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);
    });

    it('enforces non-negative protein constraint in food_nutrient_profiles', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: 'Negative Protein Food Test',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
        },
      });
      createdFoodIds.push(food.id);

      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_nutrient_profiles" ("id", "food_item_id", "calories", "protein", "carbs", "fat", "created_at", "updated_at")
          VALUES (gen_random_uuid(), ${food.id}::uuid, 100.00, -5.00, 10.00, 2.00, NOW(), NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);
    });

    it('enforces non-negative saturated fat constraint when not null', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: 'Negative Sat Fat Test',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
        },
      });
      createdFoodIds.push(food.id);

      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_nutrient_profiles" ("id", "food_item_id", "calories", "protein", "carbs", "fat", "saturated_fat", "created_at", "updated_at")
          VALUES (gen_random_uuid(), ${food.id}::uuid, 100.00, 5.00, 10.00, 2.00, -1.50, NOW(), NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);
    });

    it('enforces non-negative sodium constraint when not null', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: 'Negative Sodium Test',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
        },
      });
      createdFoodIds.push(food.id);

      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_nutrient_profiles" ("id", "food_item_id", "calories", "protein", "carbs", "fat", "sodium", "created_at", "updated_at")
          VALUES (gen_random_uuid(), ${food.id}::uuid, 100.00, 5.00, 10.00, 2.00, -25.00, NOW(), NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);
    });

    it('enforces confidence score between 0.00 and 1.00 in food_items', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_items" ("id", "name", "calories", "protein", "carbs", "fat", "confidence_score", "created_at", "updated_at")
          VALUES (gen_random_uuid(), 'Invalid Confidence Food', 100, 5, 10, 2, 1.50, NOW(), NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);

      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_items" ("id", "name", "calories", "protein", "carbs", "fat", "confidence_score", "created_at", "updated_at")
          VALUES (gen_random_uuid(), 'Invalid Negative Confidence Food', 100, 5, 10, 2, -0.20, NOW(), NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);
    });

    it('enforces positive gram weight in food_ingredients', async () => {
      const parentFood = await prisma.foodItem.create({
        data: {
          name: 'Parent Recipe Recipe',
          calories: 200,
          protein: 10,
          carbs: 20,
          fat: 5,
        },
      });
      createdFoodIds.push(parentFood.id);

      await expect(
        prisma.$executeRaw`
          INSERT INTO "food_ingredients" ("id", "parent_food_item_id", "ingredient_name", "gram_weight", "created_at")
          VALUES (gen_random_uuid(), ${parentFood.id}::uuid, 'Salt', 0.00, NOW())
        `,
      ).rejects.toThrow(/check constraint|violates check constraint/i);
    });
  });

  describe('Nutrition Data Model: Distinguishing Unknown (NULL) from Zero (0)', () => {
    it('strictly preserves NULL values and explicit zeros in food_nutrient_profiles', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: 'Distinguish Null and Zero Item',
          calories: 150,
          protein: 5,
          carbs: 20,
          fat: 3,
        },
      });
      createdFoodIds.push(food.id);

      const profile = await prisma.foodNutrientProfile.create({
        data: {
          foodItemId: food.id,
          calories: 150,
          protein: 5,
          carbs: 20,
          fat: 3,
          saturatedFat: 0.0, // Explicit verified ZERO
          transFat: null, // Unknown / unmeasured
          fiber: 2.5,
          sugar: 0.0, // Explicit ZERO
          addedSugar: null, // Unknown
          sodium: null, // Unknown
          potassium: 150.0,
        },
      });

      // Fetch back directly from database
      const fetched = await prisma.foodNutrientProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });

      // Explicit zero must be 0, NOT null
      expect(Number(fetched.saturatedFat)).toBe(0);
      expect(Number(fetched.sugar)).toBe(0);

      // Explicit null must be null, NOT zero
      expect(fetched.transFat).toBeNull();
      expect(fetched.addedSugar).toBeNull();
      expect(fetched.sodium).toBeNull();
      expect(Number(fetched.potassium)).toBe(150);
    });
  });

  describe('Deterministic Nutrition Calculations & Serving Conversions', () => {
    it('integrates shared convertServingToGrams and scaleNutrients with database record', async () => {
      const food = await prisma.foodItem.create({
        data: {
          name: 'Calculation Integration Dal',
          calories: 90, // per 100g
          protein: 5,
          carbs: 12,
          fat: 2.5,
          fiber: 3,
          servingConversions: {
            create: [
              { unitName: 'katori', gramWeight: 180, isDefault: true },
              { unitName: 'bowl', gramWeight: 250, isDefault: false },
            ],
          },
          nutrientProfile: {
            create: {
              calories: 90,
              protein: 5,
              carbs: 12,
              fat: 2.5,
              fiber: 3,
              saturatedFat: 0.5,
              sodium: 200,
            },
          },
        },
        include: {
          servingConversions: true,
          nutrientProfile: true,
        },
      });
      createdFoodIds.push(food.id);

      // Step 1: convert 1.5 katoris to grams using shared convertServingToGrams
      const conversions = food.servingConversions.map(c => ({
        unit: c.unitName,
        gramWeight: Number(c.gramWeight),
      }));

      const conversionResult = convertServingToGrams(conversions, 'katori', 1.5);
      expect(conversionResult.success).toBe(true);
      expect(conversionResult.gramWeight).toBe(270); // 1.5 * 180 = 270g

      // Step 2: Scale nutrients for 270g using shared scaleNutrients
      const baseNutrients = {
        calories: Number(food.calories),
        proteinGrams: Number(food.protein),
        carbsGrams: Number(food.carbs),
        fatGrams: Number(food.fat),
        fiberGrams: Number(food.fiber),
      };

      const scaled = scaleNutrients(baseNutrients, conversionResult.gramWeight!);
      expect(scaled.calories).toBe(243); // 90 * 2.7 = 243 kcal
      expect(scaled.proteinGrams).toBe(13.5); // 5 * 2.7 = 13.5 g
      expect(scaled.carbsGrams).toBe(32.4); // 12 * 2.7 = 32.4 g
      expect(scaled.fatGrams).toBe(6.8); // 2.5 * 2.7 = 6.75 -> 6.8 g
      expect(scaled.fiberGrams).toBe(8.1); // 3 * 2.7 = 8.1 g
    });
  });

  describe('Import Pipeline: Idempotency & Dry-Run Mode', () => {
    it('dryRun does not modify the database and returns summary', async () => {
      const service = new FoodImportService(prisma);
      const adapter = new ReferenceIndianFoodAdapter();

      const testRecord = {
        name: `Dry Run Food ${randomUUID()}`,
        nutrients: {
          calories: 100,
          protein: 5,
          carbs: 15,
          fat: 2,
        },
        servings: [{ unitName: 'piece', gramWeight: 50 }],
      };

      const summary = await service.importRecords(adapter, [testRecord], {
        dryRun: true,
        batchNumber: `DRY-BATCH-${Date.now()}`,
      });

      expect(summary.isDryRun).toBe(true);
      expect(summary.status).toBe('DRY_RUN');
      expect(summary.importedRecords).toBe(1);
      expect(summary.failedRecords).toBe(0);

      // Verify record was NOT created in DB
      const inDb = await prisma.foodItem.findFirst({
        where: { name: testRecord.name },
      });
      expect(inDb).toBeNull();
    });

    it('idempotently imports records without creating duplicate rows', async () => {
      const service = new FoodImportService(prisma);
      const adapter = new ReferenceIndianFoodAdapter();
      const uniqueName = `Idempotent Test Roti ${randomUUID()}`;

      const testRecord = {
        name: uniqueName,
        cuisine: 'INDIAN_NORTH',
        nutrients: {
          calories: 250,
          protein: 8,
          carbs: 50,
          fat: 2,
        },
        servings: [{ unitName: 'piece', gramWeight: 40 }],
      };

      // Run 1: initial import
      const summary1 = await service.importRecords(adapter, [testRecord], {
        dryRun: false,
        allowOverwriteVerified: true,
      });
      expect(summary1.importedRecords).toBe(1);

      const count1 = await prisma.foodItem.count({
        where: { name: uniqueName },
      });
      expect(count1).toBe(1);

      const foodItem = await prisma.foodItem.findFirstOrThrow({
        where: { name: uniqueName },
      });
      createdFoodIds.push(foodItem.id);

      // Run 2: repeat import
      const summary2 = await service.importRecords(adapter, [testRecord], {
        dryRun: false,
        allowOverwriteVerified: true,
      });
      expect(summary2.importedRecords).toBe(1);

      // Count in DB must still be 1 (upserted, not duplicated!)
      const count2 = await prisma.foodItem.count({
        where: { name: uniqueName },
      });
      expect(count2).toBe(1);
    });
  });
});
