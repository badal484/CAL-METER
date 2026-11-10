import { describe, it, expect } from 'vitest';
import {
  IsoDateStringSchema,
  OnboardingDataSchema,
  NutritionGoalSchema,
  UpdateNutritionGoalSchema,
  PresignUploadRequestSchema,
  CommitMealRequestSchema,
  LogWeightSchema,
  UpdateWeightLogSchema,
  LogWaterSchema,
  LogExerciseSchema,
  UpdateExerciseLogSchema,
  FoodServingConversionSchema,
  FoodNutrientProfileSchema,
  CreateCustomFoodSchema,
  UpdateCustomFoodSchema,
  FoodSearchQuerySchema,
  BarcodeParamSchema,
  PackagedProductDtoSchema,
} from '../src/index.js';
import {
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
  MealType,
  LoggedMethod,
  ServingProvenance,
  DataQuality,
  FoodSource,
  ExerciseCategory,
  ExerciseIntensity,
} from '@calmeter/shared';

describe('Contracts Runtime Schema Validation', () => {
  describe('IsoDateStringSchema', () => {
    it('accepts valid calendar dates in ISO YYYY-MM-DD format', () => {
      expect(IsoDateStringSchema.safeParse('2026-11-10').success).toBe(true);
      expect(IsoDateStringSchema.safeParse('2024-02-29').success).toBe(true); // Leap day
      expect(IsoDateStringSchema.safeParse('1995-06-15').success).toBe(true);
    });

    it('rejects impossible calendar dates', () => {
      expect(IsoDateStringSchema.safeParse('2026-02-30').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('2026-13-01').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('2025-02-29').success).toBe(false); // Non-leap year
      expect(IsoDateStringSchema.safeParse('2026-04-31').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('2026-00-10').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('2026-05-00').success).toBe(false);
    });

    it('rejects malformed date strings', () => {
      expect(IsoDateStringSchema.safeParse('15/06/1995').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('2026.11.10').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('not-a-date').success).toBe(false);
      expect(IsoDateStringSchema.safeParse('').success).toBe(false);
    });
  });

  describe('OnboardingDataSchema', () => {
    const validOnboarding = {
      gender: Gender.MALE,
      dob: '1995-06-15',
      heightCm: 178,
      currentWeightKg: 82,
      targetWeightKg: 75,
      activityLevel: ActivityLevel.MODERATELY_ACTIVE,
      dietPreference: DietPreference.VEGETARIAN,
      primaryGoal: PrimaryGoal.LOSE_WEIGHT,
      paceKgPerWeek: 0.5,
      timezone: 'Asia/Kolkata',
      preferredUnits: UnitSystem.METRIC,
    };

    it('validates a complete, accurate onboarding payload', () => {
      const parsed = OnboardingDataSchema.safeParse(validOnboarding);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid height below 100 cm', () => {
      const parsed = OnboardingDataSchema.safeParse({
        ...validOnboarding,
        heightCm: 85,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toContain('heightCm');
      }
    });

    it('rejects invalid weight below 30 kg', () => {
      const parsed = OnboardingDataSchema.safeParse({
        ...validOnboarding,
        currentWeightKg: 20,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toContain('currentWeightKg');
      }
    });

    it('rejects non-finite biometrics (NaN, Infinity)', () => {
      expect(OnboardingDataSchema.safeParse({ ...validOnboarding, heightCm: NaN }).success).toBe(
        false,
      );
      expect(
        OnboardingDataSchema.safeParse({ ...validOnboarding, currentWeightKg: Infinity }).success,
      ).toBe(false);
      expect(
        OnboardingDataSchema.safeParse({ ...validOnboarding, paceKgPerWeek: NaN }).success,
      ).toBe(false);
    });

    it('rejects malformed or impossible date of birth string', () => {
      expect(
        OnboardingDataSchema.safeParse({ ...validOnboarding, dob: '15/06/1995' }).success,
      ).toBe(false);
      expect(
        OnboardingDataSchema.safeParse({ ...validOnboarding, dob: '2026-02-30' }).success,
      ).toBe(false);
      expect(
        OnboardingDataSchema.safeParse({ ...validOnboarding, dob: '2026-13-01' }).success,
      ).toBe(false);
    });

    it('handles exact age boundary of 120 years and rejects one year beyond (121 years)', () => {
      // Current year is 2026. A DOB in 1906 yields age 120 (valid boundary)
      const exactBoundary = OnboardingDataSchema.safeParse({
        ...validOnboarding,
        dob: '1906-11-10',
      });
      expect(exactBoundary.success).toBe(true);

      // A DOB in 1905 yields age 121 (exceeds MAXIMUM_SUPPORTED_AGE_YEARS)
      const beyondBoundary = OnboardingDataSchema.safeParse({
        ...validOnboarding,
        dob: '1905-11-10',
      });
      expect(beyondBoundary.success).toBe(false);
      if (!beyondBoundary.success) {
        expect(beyondBoundary.error.issues[0]?.path).toContain('dob');
      }
    });

    it('rejects date of birth in the future', () => {
      // Future date
      const futureParsed = OnboardingDataSchema.safeParse({
        ...validOnboarding,
        dob: '2030-01-01',
      });
      expect(futureParsed.success).toBe(false);
    });
  });

  describe('NutritionGoalSchema & UpdateNutritionGoalSchema', () => {
    it('accepts valid macro and calorie goals', () => {
      const valid = {
        dailyCalories: 2100,
        proteinGrams: 150,
        carbsGrams: 220,
        fatGrams: 65,
        fiberGrams: 30,
        waterMl: 3000,
      };
      const parsed = UpdateNutritionGoalSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('accepts dailyCalories below 500 kcal without an arbitrary floor', () => {
      // Policy Part 2.1: removed arbitrary 500 kcal floor
      const parsed = UpdateNutritionGoalSchema.safeParse({
        dailyCalories: 400,
        proteinGrams: 50,
        carbsGrams: 50,
        fatGrams: 10,
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects non-positive dailyCalories (0 or negative)', () => {
      expect(
        UpdateNutritionGoalSchema.safeParse({
          dailyCalories: 0,
        }).success,
      ).toBe(false);

      expect(
        UpdateNutritionGoalSchema.safeParse({
          dailyCalories: -100,
        }).success,
      ).toBe(false);
    });

    it('rejects non-finite dailyCalories (NaN, Infinity)', () => {
      expect(
        UpdateNutritionGoalSchema.safeParse({
          dailyCalories: NaN,
        }).success,
      ).toBe(false);

      expect(
        UpdateNutritionGoalSchema.safeParse({
          dailyCalories: Infinity,
        }).success,
      ).toBe(false);
    });

    it('rejects negative macronutrient grams', () => {
      const parsed = UpdateNutritionGoalSchema.safeParse({
        dailyCalories: 2000,
        proteinGrams: -20,
        carbsGrams: 200,
        fatGrams: 60,
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects non-finite macronutrient grams (NaN, Infinity)', () => {
      expect(
        UpdateNutritionGoalSchema.safeParse({
          proteinGrams: NaN,
        }).success,
      ).toBe(false);
      expect(
        UpdateNutritionGoalSchema.safeParse({
          carbsGrams: Infinity,
        }).success,
      ).toBe(false);
      expect(
        UpdateNutritionGoalSchema.safeParse({
          fatGrams: -Infinity,
        }).success,
      ).toBe(false);
    });

    it('validates complete NutritionGoalSchema', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        dailyCalories: 2200,
        proteinGrams: 140,
        carbsGrams: 250,
        fatGrams: 70,
        fiberGrams: 35,
        waterMl: 3000,
        effectiveDate: '2026-11-10',
        createdAt: '2026-11-10T12:00:00.000Z',
      };
      expect(NutritionGoalSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe('PresignUploadRequestSchema', () => {
    it('accepts JPEG, PNG, and WebP mime types within 10MB limit', () => {
      expect(
        PresignUploadRequestSchema.safeParse({
          contentType: 'image/jpeg',
          fileSizeBytes: 245000,
        }).success,
      ).toBe(true);

      expect(
        PresignUploadRequestSchema.safeParse({
          contentType: 'image/png',
          fileSizeBytes: 500000,
        }).success,
      ).toBe(true);
    });

    it('rejects unsupported mime types (e.g. PDF or GIF)', () => {
      expect(
        PresignUploadRequestSchema.safeParse({
          contentType: 'application/pdf',
          fileSizeBytes: 100000,
        }).success,
      ).toBe(false);
    });

    it('rejects image files exceeding 10 MB limit', () => {
      expect(
        PresignUploadRequestSchema.safeParse({
          contentType: 'image/jpeg',
          fileSizeBytes: 15 * 1024 * 1024, // 15 MB
        }).success,
      ).toBe(false);
    });

    it('rejects non-finite or negative fileSizeBytes', () => {
      expect(
        PresignUploadRequestSchema.safeParse({
          contentType: 'image/jpeg',
          fileSizeBytes: NaN,
        }).success,
      ).toBe(false);
      expect(
        PresignUploadRequestSchema.safeParse({
          contentType: 'image/jpeg',
          fileSizeBytes: -1,
        }).success,
      ).toBe(false);
    });
  });

  describe('FoodServingConversionSchema', () => {
    it('validates a food-specific conversion definition', () => {
      const valid = {
        unit: 'katori',
        gramWeight: 200,
        volumeMl: 200,
        provenance: ServingProvenance.ESTIMATED_HOUSEHOLD,
        notes: 'Illustrative household estimate for 200ml katori',
      };
      const parsed = FoodServingConversionSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects non-positive or non-finite gramWeight', () => {
      expect(
        FoodServingConversionSchema.safeParse({
          unit: 'roti',
          gramWeight: 0,
          provenance: ServingProvenance.USER_CONFIGURED,
        }).success,
      ).toBe(false);

      expect(
        FoodServingConversionSchema.safeParse({
          unit: 'roti',
          gramWeight: -35,
          provenance: ServingProvenance.USER_CONFIGURED,
        }).success,
      ).toBe(false);

      expect(
        FoodServingConversionSchema.safeParse({
          unit: 'roti',
          gramWeight: NaN,
          provenance: ServingProvenance.USER_CONFIGURED,
        }).success,
      ).toBe(false);
    });
  });

  describe('CommitMealRequestSchema', () => {
    it('validates a meal commit containing at least one item', () => {
      const valid = {
        date: '2026-11-10',
        mealType: MealType.LUNCH,
        notes: 'Post workout meal',
        items: [
          {
            foodName: 'Yellow Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: 184,
            protein: 9.2,
            carbs: 24.5,
            fat: 5.6,
            loggedMethod: LoggedMethod.AI_PHOTO,
          },
        ],
      };
      const parsed = CommitMealRequestSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects a meal commit with zero items', () => {
      const invalid = {
        date: '2026-11-10',
        mealType: MealType.LUNCH,
        items: [],
      };
      const parsed = CommitMealRequestSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('at least one food item');
      }
    });

    it('rejects items with non-finite or negative nutrients', () => {
      const invalidItem = {
        date: '2026-11-10',
        mealType: MealType.LUNCH,
        items: [
          {
            foodName: 'Yellow Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: NaN,
            protein: 9.2,
            carbs: 24.5,
            fat: 5.6,
            loggedMethod: LoggedMethod.AI_PHOTO,
          },
        ],
      };
      expect(CommitMealRequestSchema.safeParse(invalidItem).success).toBe(false);

      const negativeItem = {
        date: '2026-11-10',
        mealType: MealType.LUNCH,
        items: [
          {
            foodName: 'Yellow Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: 184,
            protein: -5,
            carbs: 24.5,
            fat: 5.6,
            loggedMethod: LoggedMethod.AI_PHOTO,
          },
        ],
      };
      expect(CommitMealRequestSchema.safeParse(negativeItem).success).toBe(false);
    });

    it('rejects impossible calendar date in meal commit', () => {
      const invalidDate = {
        date: '2026-02-30',
        mealType: MealType.LUNCH,
        items: [
          {
            foodName: 'Yellow Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: 184,
            protein: 9.2,
            carbs: 24.5,
            fat: 5.6,
            loggedMethod: LoggedMethod.AI_PHOTO,
          },
        ],
      };
      expect(CommitMealRequestSchema.safeParse(invalidDate).success).toBe(false);
    });
  });

  describe('LogWeightSchema & LogWaterSchema', () => {
    it('validates a normal weight reading', () => {
      expect(LogWeightSchema.safeParse({ weightKg: 78.4 }).success).toBe(true);
    });

    it('rejects out of bounds weight (< 30 kg or > 350 kg)', () => {
      expect(LogWeightSchema.safeParse({ weightKg: 25 }).success).toBe(false);
      expect(LogWeightSchema.safeParse({ weightKg: 400 }).success).toBe(false);
    });

    it('rejects non-finite weight (NaN, Infinity)', () => {
      expect(LogWeightSchema.safeParse({ weightKg: NaN }).success).toBe(false);
      expect(LogWeightSchema.safeParse({ weightKg: Infinity }).success).toBe(false);
    });

    it('validates LogWaterSchema and rejects non-finite or out-of-range ml', () => {
      const base = { date: '2026-11-10' };
      expect(LogWaterSchema.safeParse({ ...base, amountMl: 500 }).success).toBe(true);
      expect(LogWaterSchema.safeParse({ ...base, amountMl: 0 }).success).toBe(false);
      expect(LogWaterSchema.safeParse({ ...base, amountMl: -250 }).success).toBe(false);
      expect(LogWaterSchema.safeParse({ ...base, amountMl: NaN }).success).toBe(false);
      expect(LogWaterSchema.safeParse({ ...base, amountMl: Infinity }).success).toBe(false);
      expect(LogWaterSchema.safeParse({ ...base, amountMl: 6000 }).success).toBe(false); // > 5000 limit
      expect(LogWaterSchema.safeParse({ date: '2026-02-30', amountMl: 500 }).success).toBe(false);
    });

    it('validates UpdateWeightLogSchema partial updates', () => {
      expect(UpdateWeightLogSchema.safeParse({ weightKg: 82.5 }).success).toBe(true);
      expect(UpdateWeightLogSchema.safeParse({ notes: 'After morning run' }).success).toBe(true);
      expect(UpdateWeightLogSchema.safeParse({ weightKg: 20 }).success).toBe(false);
    });

    it('validates LogExerciseSchema with valid parameters', () => {
      const valid = {
        name: 'Morning Jog',
        category: ExerciseCategory.RUNNING,
        durationMinutes: 30,
        distanceKm: 4.5,
        intensity: ExerciseIntensity.MODERATE,
      };
      expect(LogExerciseSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects LogExerciseSchema with zero or excessive duration', () => {
      const base = {
        name: 'Yoga Session',
        category: ExerciseCategory.YOGA,
      };
      expect(LogExerciseSchema.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
      expect(LogExerciseSchema.safeParse({ ...base, durationMinutes: -15 }).success).toBe(false);
      expect(LogExerciseSchema.safeParse({ ...base, durationMinutes: 1500 }).success).toBe(false); // > 1440
    });

    it('validates UpdateExerciseLogSchema optional updates', () => {
      expect(UpdateExerciseLogSchema.safeParse({ durationMinutes: 45 }).success).toBe(true);
      expect(UpdateExerciseLogSchema.safeParse({ notes: 'Felt energetic' }).success).toBe(true);
      expect(UpdateExerciseLogSchema.safeParse({ caloriesBurned: 350 }).success).toBe(true);
      expect(UpdateExerciseLogSchema.safeParse({ caloriesBurned: -50 }).success).toBe(false);
    });
  });

  describe('Food Database & Nutrition Contracts', () => {
    describe('FoodNutrientProfileSchema', () => {
      const validProfile = {
        calories: 184,
        protein: 9.2,
        carbs: 24.5,
        fat: 5.6,
        saturatedFat: 1.2,
        transFat: 0,
        fiber: 5.2,
        sugar: 1.5,
        addedSugar: 0,
        sodium: 320,
        cholesterol: 0,
        potassium: 280,
        calcium: 45,
        iron: 2.1,
        vitaminD: null,
        vitaminB12: null,
        micronutrients: { zinc: 1.1, magnesium: 35 },
      };

      it('validates a complete nutrient profile per 100g', () => {
        const parsed = FoodNutrientProfileSchema.safeParse(validProfile);
        expect(parsed.success).toBe(true);
      });

      it('strictly distinguishes explicit zero from unknown (null / undefined)', () => {
        const profileWithExplicitZerosAndNulls = {
          calories: 120,
          protein: 5,
          carbs: 20,
          fat: 2,
          saturatedFat: 0, // Explicit zero
          transFat: null, // Explicitly unknown
          sugar: 0, // Explicit zero
          addedSugar: null, // Unknown
          sodium: null, // Unknown
        };

        const result = FoodNutrientProfileSchema.safeParse(profileWithExplicitZerosAndNulls);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.saturatedFat).toBe(0);
          expect(result.data.transFat).toBeNull();
          expect(result.data.sugar).toBe(0);
          expect(result.data.addedSugar).toBeNull();
          expect(result.data.sodium).toBeNull();
        }
      });

      it('rejects negative nutrient values', () => {
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, calories: -10 }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, protein: -0.5 }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, saturatedFat: -1 }).success,
        ).toBe(false);
        expect(FoodNutrientProfileSchema.safeParse({ ...validProfile, sodium: -50 }).success).toBe(
          false,
        );
      });

      it('rejects non-finite nutrient values (NaN, Infinity)', () => {
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, calories: NaN }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, carbs: Infinity }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, calcium: -Infinity }).success,
        ).toBe(false);
      });
    });

    describe('CreateCustomFoodSchema & UpdateCustomFoodSchema', () => {
      const validCustomFood = {
        name: 'Maa ki Dal (Mom style)',
        localNames: ['Dal Makhani Homestyle'],
        brand: 'Homemade',
        cuisine: 'INDIAN_NORTH',
        servingSize: 180,
        servingUnit: 'katori',
        calories: 210,
        protein: 8.5,
        carbs: 26,
        fat: 7.8,
        fiber: 6.2,
        sodium: 380,
      };

      it('validates custom food creation payload', () => {
        const parsed = CreateCustomFoodSchema.safeParse(validCustomFood);
        expect(parsed.success).toBe(true);
      });

      it('rejects custom food without a name', () => {
        expect(CreateCustomFoodSchema.safeParse({ ...validCustomFood, name: '' }).success).toBe(
          false,
        );
      });

      it('rejects negative calories or macros on custom food creation', () => {
        expect(
          CreateCustomFoodSchema.safeParse({ ...validCustomFood, calories: -100 }).success,
        ).toBe(false);
        expect(CreateCustomFoodSchema.safeParse({ ...validCustomFood, protein: -5 }).success).toBe(
          false,
        );
        expect(CreateCustomFoodSchema.safeParse({ ...validCustomFood, fat: -1 }).success).toBe(
          false,
        );
      });

      it('allows partial updates with UpdateCustomFoodSchema', () => {
        const partialUpdate = {
          name: 'Updated Mom style Dal',
          calories: 195,
        };
        const parsed = UpdateCustomFoodSchema.safeParse(partialUpdate);
        expect(parsed.success).toBe(true);
      });
    });

    describe('FoodSearchQuerySchema', () => {
      it('validates a standard search query with defaults', () => {
        const parsed = FoodSearchQuerySchema.safeParse({ q: 'roti' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.q).toBe('roti');
          expect(parsed.data.page).toBe(1);
          expect(parsed.data.limit).toBe(20);
          expect(parsed.data.sortBy).toBe('relevance');
          expect(parsed.data.sortOrder).toBe('asc');
        }
      });

      it('coerces string page and limit parameters safely', () => {
        const parsed = FoodSearchQuerySchema.safeParse({
          q: 'paneer',
          page: '2',
          limit: '50',
          sortBy: 'protein',
          sortOrder: 'desc',
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.page).toBe(2);
          expect(parsed.data.limit).toBe(50);
          expect(parsed.data.sortBy).toBe('protein');
          expect(parsed.data.sortOrder).toBe('desc');
        }
      });

      it('rejects limit exceeding 100 to prevent unbounded queries', () => {
        const parsed = FoodSearchQuerySchema.safeParse({ q: 'dal', limit: '500' });
        expect(parsed.success).toBe(false);
      });
    });

    describe('Barcode & Packaged Food Contracts', () => {
      it('validates and normalizes BarcodeParamSchema input', () => {
        const parsed = BarcodeParamSchema.safeParse({ barcode: ' 8901030-825484 ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.barcode).toBe('8901030825484');
        }
      });

      it('rejects empty or excessive barcode in BarcodeParamSchema', () => {
        expect(BarcodeParamSchema.safeParse({ barcode: '' }).success).toBe(false);
        expect(BarcodeParamSchema.safeParse({ barcode: 'a'.repeat(65) }).success).toBe(false);
      });

      it('validates a complete PackagedProductDtoSchema payload', () => {
        const product = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          additionalBarcodes: ['08901030825484'],
          name: 'Parle-G Original Gluco Biscuits',
          brand: 'Parle',
          manufacturer: 'Parle Products Pvt. Ltd.',
          imageUrl:
            'https://images.openfoodfacts.org/images/products/890/103/082/5484/front_en.jpg',
          categories: ['Snacks', 'Sweet snacks', 'Biscuits and cakes'],
          countries: ['India', 'United States'],
          ingredientsText: 'Wheat flour, sugar, edible vegetable oil, invert sugar syrup, salt.',
          allergens: ['wheat', 'gluten'],
          servingSize: 30,
          servingUnit: 'g',
          standardWeightGrams: 100,
          netWeightGrams: 250,
          isLiquid: false,
          nutrientsPer100g: {
            calories: 450,
            protein: 7.5,
            carbs: 78,
            fat: 13,
            fiber: 2.5,
            sugar: 26,
            sodium: 280,
            micronutrients: {},
          },
          nutrientsPerServing: {
            calories: 135,
            protein: 2.25,
            carbs: 23.4,
            fat: 3.9,
            fiber: 0.75,
            sugar: 7.8,
            sodium: 84,
            micronutrients: {},
          },
          servingConversions: [
            {
              unit: 'biscuit',
              gramWeight: 5,
              servingDescription: '1 biscuit (~5g)',
            },
          ],
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Data sourced from Open Food Facts under ODbL 1.0',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.EXTERNAL_SOURCE,
          missingNutrients: [],
        };

        const parsed = PackagedProductDtoSchema.safeParse(product);
        expect(parsed.success).toBe(true);
      });

      it('rejects negative nutrients in PackagedProductDtoSchema', () => {
        const invalid = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          name: 'Test Product',
          servingSize: 100,
          servingUnit: 'g',
          standardWeightGrams: 100,
          nutrientsPer100g: {
            calories: -100, // Invalid!
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Test',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.INCOMPLETE,
        };

        const parsed = PackagedProductDtoSchema.safeParse(invalid);
        expect(parsed.success).toBe(false);
      });
    });

    describe('Barcode & Packaged Food Contracts', () => {
      it('validates and normalizes BarcodeParamSchema input', () => {
        const parsed = BarcodeParamSchema.safeParse({ barcode: ' 8901030-825484 ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.barcode).toBe('8901030825484');
        }
      });

      it('rejects empty or excessive barcode in BarcodeParamSchema', () => {
        expect(BarcodeParamSchema.safeParse({ barcode: '' }).success).toBe(false);
        expect(BarcodeParamSchema.safeParse({ barcode: 'a'.repeat(65) }).success).toBe(false);
      });

      it('validates a complete PackagedProductDtoSchema payload', () => {
        const product = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          additionalBarcodes: ['08901030825484'],
          name: 'Parle-G Original Gluco Biscuits',
          brand: 'Parle',
          manufacturer: 'Parle Products Pvt. Ltd.',
          imageUrl:
            'https://images.openfoodfacts.org/images/products/890/103/082/5484/front_en.jpg',
          categories: ['Snacks', 'Sweet snacks', 'Biscuits and cakes'],
          countries: ['India', 'United States'],
          ingredientsText: 'Wheat flour, sugar, edible vegetable oil, invert sugar syrup, salt.',
          allergens: ['wheat', 'gluten'],
          servingSize: 30,
          servingUnit: 'g',
          standardWeightGrams: 100,
          netWeightGrams: 250,
          isLiquid: false,
          nutrientsPer100g: {
            calories: 450,
            protein: 7.5,
            carbs: 78,
            fat: 13,
            fiber: 2.5,
            sugar: 26,
            sodium: 280,
            micronutrients: {},
          },
          nutrientsPerServing: {
            calories: 135,
            protein: 2.25,
            carbs: 23.4,
            fat: 3.9,
            fiber: 0.75,
            sugar: 7.8,
            sodium: 84,
            micronutrients: {},
          },
          servingConversions: [
            {
              unit: 'biscuit',
              gramWeight: 5,
              servingDescription: '1 biscuit (~5g)',
            },
          ],
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Data sourced from Open Food Facts under ODbL 1.0',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.EXTERNAL_SOURCE,
          missingNutrients: [],
        };

        const parsed = PackagedProductDtoSchema.safeParse(product);
        expect(parsed.success).toBe(true);
      });

      it('rejects negative nutrients in PackagedProductDtoSchema', () => {
        const invalid = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          name: 'Test Product',
          servingSize: 100,
          servingUnit: 'g',
          standardWeightGrams: 100,
          nutrientsPer100g: {
            calories: -100, // Invalid!
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Test',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.INCOMPLETE,
        };

        const parsed = PackagedProductDtoSchema.safeParse(invalid);
        expect(parsed.success).toBe(false);
      });
    });
  });

  describe('Food Database & Nutrition Contracts', () => {
    describe('FoodNutrientProfileSchema', () => {
      const validProfile = {
        calories: 184,
        protein: 9.2,
        carbs: 24.5,
        fat: 5.6,
        saturatedFat: 1.2,
        transFat: 0,
        fiber: 5.2,
        sugar: 1.5,
        addedSugar: 0,
        sodium: 320,
        cholesterol: 0,
        potassium: 280,
        calcium: 45,
        iron: 2.1,
        vitaminD: null,
        vitaminB12: null,
        micronutrients: { zinc: 1.1, magnesium: 35 },
      };

      it('validates a complete nutrient profile per 100g', () => {
        const parsed = FoodNutrientProfileSchema.safeParse(validProfile);
        expect(parsed.success).toBe(true);
      });

      it('strictly distinguishes explicit zero from unknown (null / undefined)', () => {
        const profileWithExplicitZerosAndNulls = {
          calories: 120,
          protein: 5,
          carbs: 20,
          fat: 2,
          saturatedFat: 0, // Explicit zero
          transFat: null, // Explicitly unknown
          sugar: 0, // Explicit zero
          addedSugar: null, // Unknown
          sodium: null, // Unknown
        };

        const result = FoodNutrientProfileSchema.safeParse(profileWithExplicitZerosAndNulls);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.saturatedFat).toBe(0);
          expect(result.data.transFat).toBeNull();
          expect(result.data.sugar).toBe(0);
          expect(result.data.addedSugar).toBeNull();
          expect(result.data.sodium).toBeNull();
        }
      });

      it('rejects negative nutrient values', () => {
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, calories: -10 }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, protein: -0.5 }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, saturatedFat: -1 }).success,
        ).toBe(false);
        expect(FoodNutrientProfileSchema.safeParse({ ...validProfile, sodium: -50 }).success).toBe(
          false,
        );
      });

      it('rejects non-finite nutrient values (NaN, Infinity)', () => {
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, calories: NaN }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, carbs: Infinity }).success,
        ).toBe(false);
        expect(
          FoodNutrientProfileSchema.safeParse({ ...validProfile, calcium: -Infinity }).success,
        ).toBe(false);
      });
    });

    describe('CreateCustomFoodSchema & UpdateCustomFoodSchema', () => {
      const validCustomFood = {
        name: 'Maa ki Dal (Mom style)',
        localNames: ['Dal Makhani Homestyle'],
        brand: 'Homemade',
        cuisine: 'INDIAN_NORTH',
        servingSize: 180,
        servingUnit: 'katori',
        calories: 210,
        protein: 8.5,
        carbs: 26,
        fat: 7.8,
        fiber: 6.2,
        sodium: 380,
      };

      it('validates custom food creation payload', () => {
        const parsed = CreateCustomFoodSchema.safeParse(validCustomFood);
        expect(parsed.success).toBe(true);
      });

      it('rejects custom food without a name', () => {
        expect(CreateCustomFoodSchema.safeParse({ ...validCustomFood, name: '' }).success).toBe(
          false,
        );
      });

      it('rejects negative calories or macros on custom food creation', () => {
        expect(
          CreateCustomFoodSchema.safeParse({ ...validCustomFood, calories: -100 }).success,
        ).toBe(false);
        expect(CreateCustomFoodSchema.safeParse({ ...validCustomFood, protein: -5 }).success).toBe(
          false,
        );
        expect(CreateCustomFoodSchema.safeParse({ ...validCustomFood, fat: -1 }).success).toBe(
          false,
        );
      });

      it('allows partial updates with UpdateCustomFoodSchema', () => {
        const partialUpdate = {
          name: 'Updated Mom style Dal',
          calories: 195,
        };
        const parsed = UpdateCustomFoodSchema.safeParse(partialUpdate);
        expect(parsed.success).toBe(true);
      });
    });

    describe('FoodSearchQuerySchema', () => {
      it('validates a standard search query with defaults', () => {
        const parsed = FoodSearchQuerySchema.safeParse({ q: 'roti' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.q).toBe('roti');
          expect(parsed.data.page).toBe(1);
          expect(parsed.data.limit).toBe(20);
          expect(parsed.data.sortBy).toBe('relevance');
          expect(parsed.data.sortOrder).toBe('asc');
        }
      });

      it('coerces string page and limit parameters safely', () => {
        const parsed = FoodSearchQuerySchema.safeParse({
          q: 'paneer',
          page: '2',
          limit: '50',
          sortBy: 'protein',
          sortOrder: 'desc',
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.page).toBe(2);
          expect(parsed.data.limit).toBe(50);
          expect(parsed.data.sortBy).toBe('protein');
          expect(parsed.data.sortOrder).toBe('desc');
        }
      });

      it('rejects limit exceeding 100 to prevent unbounded queries', () => {
        const parsed = FoodSearchQuerySchema.safeParse({ q: 'dal', limit: '500' });
        expect(parsed.success).toBe(false);
      });
    });

    describe('Barcode & Packaged Food Contracts', () => {
      it('validates and normalizes BarcodeParamSchema input', () => {
        const parsed = BarcodeParamSchema.safeParse({ barcode: ' 8901030-825484 ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.barcode).toBe('8901030825484');
        }
      });

      it('rejects empty or excessive barcode in BarcodeParamSchema', () => {
        expect(BarcodeParamSchema.safeParse({ barcode: '' }).success).toBe(false);
        expect(BarcodeParamSchema.safeParse({ barcode: 'a'.repeat(65) }).success).toBe(false);
      });

      it('validates a complete PackagedProductDtoSchema payload', () => {
        const product = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          additionalBarcodes: ['08901030825484'],
          name: 'Parle-G Original Gluco Biscuits',
          brand: 'Parle',
          manufacturer: 'Parle Products Pvt. Ltd.',
          imageUrl:
            'https://images.openfoodfacts.org/images/products/890/103/082/5484/front_en.jpg',
          categories: ['Snacks', 'Sweet snacks', 'Biscuits and cakes'],
          countries: ['India', 'United States'],
          ingredientsText: 'Wheat flour, sugar, edible vegetable oil, invert sugar syrup, salt.',
          allergens: ['wheat', 'gluten'],
          servingSize: 30,
          servingUnit: 'g',
          standardWeightGrams: 100,
          netWeightGrams: 250,
          isLiquid: false,
          nutrientsPer100g: {
            calories: 450,
            protein: 7.5,
            carbs: 78,
            fat: 13,
            fiber: 2.5,
            sugar: 26,
            sodium: 280,
            micronutrients: {},
          },
          nutrientsPerServing: {
            calories: 135,
            protein: 2.25,
            carbs: 23.4,
            fat: 3.9,
            fiber: 0.75,
            sugar: 7.8,
            sodium: 84,
            micronutrients: {},
          },
          servingConversions: [
            {
              unit: 'biscuit',
              gramWeight: 5,
              servingDescription: '1 biscuit (~5g)',
            },
          ],
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Data sourced from Open Food Facts under ODbL 1.0',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.EXTERNAL_SOURCE,
          missingNutrients: [],
        };

        const parsed = PackagedProductDtoSchema.safeParse(product);
        expect(parsed.success).toBe(true);
      });

      it('rejects negative nutrients in PackagedProductDtoSchema', () => {
        const invalid = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          name: 'Test Product',
          servingSize: 100,
          servingUnit: 'g',
          standardWeightGrams: 100,
          nutrientsPer100g: {
            calories: -100, // Invalid!
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Test',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.INCOMPLETE,
        };

        const parsed = PackagedProductDtoSchema.safeParse(invalid);
        expect(parsed.success).toBe(false);
      });
    });

    describe('Barcode & Packaged Food Contracts', () => {
      it('validates and normalizes BarcodeParamSchema input', () => {
        const parsed = BarcodeParamSchema.safeParse({ barcode: ' 8901030-825484 ' });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.barcode).toBe('8901030825484');
        }
      });

      it('rejects empty or excessive barcode in BarcodeParamSchema', () => {
        expect(BarcodeParamSchema.safeParse({ barcode: '' }).success).toBe(false);
        expect(BarcodeParamSchema.safeParse({ barcode: 'a'.repeat(65) }).success).toBe(false);
      });

      it('validates a complete PackagedProductDtoSchema payload', () => {
        const product = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          additionalBarcodes: ['08901030825484'],
          name: 'Parle-G Original Gluco Biscuits',
          brand: 'Parle',
          manufacturer: 'Parle Products Pvt. Ltd.',
          imageUrl:
            'https://images.openfoodfacts.org/images/products/890/103/082/5484/front_en.jpg',
          categories: ['Snacks', 'Sweet snacks', 'Biscuits and cakes'],
          countries: ['India', 'United States'],
          ingredientsText: 'Wheat flour, sugar, edible vegetable oil, invert sugar syrup, salt.',
          allergens: ['wheat', 'gluten'],
          servingSize: 30,
          servingUnit: 'g',
          standardWeightGrams: 100,
          netWeightGrams: 250,
          isLiquid: false,
          nutrientsPer100g: {
            calories: 450,
            protein: 7.5,
            carbs: 78,
            fat: 13,
            fiber: 2.5,
            sugar: 26,
            sodium: 280,
            micronutrients: {},
          },
          nutrientsPerServing: {
            calories: 135,
            protein: 2.25,
            carbs: 23.4,
            fat: 3.9,
            fiber: 0.75,
            sugar: 7.8,
            sodium: 84,
            micronutrients: {},
          },
          servingConversions: [
            {
              unit: 'biscuit',
              gramWeight: 5,
              servingDescription: '1 biscuit (~5g)',
            },
          ],
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Data sourced from Open Food Facts under ODbL 1.0',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.EXTERNAL_SOURCE,
          missingNutrients: [],
        };

        const parsed = PackagedProductDtoSchema.safeParse(product);
        expect(parsed.success).toBe(true);
      });

      it('rejects negative nutrients in PackagedProductDtoSchema', () => {
        const invalid = {
          id: 'b6f6d0a7-47b7-4c7b-b5d4-5b23d9a04a11',
          barcode: '8901030825484',
          name: 'Test Product',
          servingSize: 100,
          servingUnit: 'g',
          standardWeightGrams: 100,
          nutrientsPer100g: {
            calories: -100, // Invalid!
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: FoodSource.OPEN_FOOD_FACTS,
          attribution: 'Test',
          license: 'ODbL 1.0',
          isVerified: false,
          dataQuality: DataQuality.INCOMPLETE,
        };

        const parsed = PackagedProductDtoSchema.safeParse(invalid);
        expect(parsed.success).toBe(false);
      });
    });
  });

  describe('AI Nutrition Coach & Personalized Insights Contracts (Part 11)', () => {
    it('validates SendCoachMessageSchema constraints', async () => {
      const { SendCoachMessageSchema } = await import('../src/coach.contract.js');

      expect(
        SendCoachMessageSchema.safeParse({ message: 'How is my protein intake today?' }).success,
      ).toBe(true);
      expect(SendCoachMessageSchema.safeParse({ message: '' }).success).toBe(false);
      expect(SendCoachMessageSchema.safeParse({ message: '   ' }).success).toBe(false);
      expect(SendCoachMessageSchema.safeParse({ message: 'a'.repeat(2001) }).success).toBe(false);
    });

    it('validates PersonalizedInsightSchema structure', async () => {
      const { PersonalizedInsightSchema } = await import('../src/coach.contract.js');
      const { InsightType, InsightCategory } = await import('@calmeter/shared');

      const insight = {
        type: InsightType.PROTEIN_PACING,
        category: InsightCategory.RECOMMENDATION,
        title: 'Protein Density Opportunity',
        message: 'You have reached 45% of your protein target.',
        actionableTip: 'Add paneer or dal to your dinner.',
        periodAnalyzed: 'TODAY',
        metricData: { current: 45, target: 140, unit: 'g' },
      };

      expect(PersonalizedInsightSchema.safeParse(insight).success).toBe(true);
    });

    it('validates MealRecommendationSchema with verified food items', async () => {
      const { MealRecommendationSchema } = await import('../src/coach.contract.js');
      const { MealType } = await import('@calmeter/shared');

      const meal = {
        id: 'rec-1',
        mealType: MealType.DINNER,
        title: 'High-Protein Moong Dal & Phulkas',
        description: 'Balanced vegetarian dinner fitting your remaining calorie deficit.',
        cuisine: 'North Indian',
        totalCalories: 480,
        totalProtein: 22,
        totalCarbs: 68,
        totalFat: 10,
        items: [
          {
            foodName: 'Moong Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: 220,
            protein: 12,
            carbs: 28,
            fat: 6,
            isVerified: true,
          },
          {
            foodName: 'Whole Wheat Phulka',
            portionAmount: 2,
            servingUnit: 'piece',
            gramWeight: 70,
            calories: 160,
            protein: 6,
            carbs: 32,
            fat: 1,
            isVerified: true,
          },
        ],
        fitsRemainingBudget: true,
        dietaryTags: ['VEGETARIAN', 'HIGH_FIBER'],
      };

      expect(MealRecommendationSchema.safeParse(meal).success).toBe(true);
    });
  });

  describe('AI Nutrition Coach & Personalized Insights Contracts (Part 11)', () => {
    it('validates SendCoachMessageSchema constraints', async () => {
      const { SendCoachMessageSchema } = await import('../src/coach.contract.js');

      expect(
        SendCoachMessageSchema.safeParse({ message: 'How is my protein intake today?' }).success,
      ).toBe(true);
      expect(SendCoachMessageSchema.safeParse({ message: '' }).success).toBe(false);
      expect(SendCoachMessageSchema.safeParse({ message: '   ' }).success).toBe(false);
      expect(SendCoachMessageSchema.safeParse({ message: 'a'.repeat(2001) }).success).toBe(false);
    });

    it('validates PersonalizedInsightSchema structure', async () => {
      const { PersonalizedInsightSchema } = await import('../src/coach.contract.js');
      const { InsightType, InsightCategory } = await import('@calmeter/shared');

      const insight = {
        type: InsightType.PROTEIN_PACING,
        category: InsightCategory.RECOMMENDATION,
        title: 'Protein Density Opportunity',
        message: 'You have reached 45% of your protein target.',
        actionableTip: 'Add paneer or dal to your dinner.',
        periodAnalyzed: 'TODAY',
        metricData: { current: 45, target: 140, unit: 'g' },
      };

      expect(PersonalizedInsightSchema.safeParse(insight).success).toBe(true);
    });

    it('validates MealRecommendationSchema with verified food items', async () => {
      const { MealRecommendationSchema } = await import('../src/coach.contract.js');
      const { MealType } = await import('@calmeter/shared');

      const meal = {
        id: 'rec-1',
        mealType: MealType.DINNER,
        title: 'High-Protein Moong Dal & Phulkas',
        description: 'Balanced vegetarian dinner fitting your remaining calorie deficit.',
        cuisine: 'North Indian',
        totalCalories: 480,
        totalProtein: 22,
        totalCarbs: 68,
        totalFat: 10,
        items: [
          {
            foodName: 'Moong Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: 220,
            protein: 12,
            carbs: 28,
            fat: 6,
            isVerified: true,
          },
          {
            foodName: 'Whole Wheat Phulka',
            portionAmount: 2,
            servingUnit: 'piece',
            gramWeight: 70,
            calories: 160,
            protein: 6,
            carbs: 32,
            fat: 1,
            isVerified: true,
          },
        ],
        fitsRemainingBudget: true,
        dietaryTags: ['VEGETARIAN', 'HIGH_FIBER'],
      };

      expect(MealRecommendationSchema.safeParse(meal).success).toBe(true);
    });
  });

  describe('Subscriptions, Payments & Entitlements Contracts (Part 12)', () => {
    it('validates SubscriptionStatusResponseSchema', async () => {
      const { SubscriptionStatusResponseSchema } = await import('../src/subscription.contract.js');
      const { SubscriptionTier, SubscriptionStatus, SubscriptionStore, FeatureKey } =
        await import('@calmeter/shared');

      const payload = {
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        store: SubscriptionStore.APP_STORE,
        planId: 'monthly_premium',
        productId: 'com.calmeter.premium.monthly',
        entitlements: ['premium_access'],
        expiresAt: '2026-12-10T12:00:00.000Z',
        autoRenewStatus: true,
        isSandbox: false,
        billingIssue: false,
        cancelReason: null,
        dailyUsage: {
          [FeatureKey.AI_PHOTO_SCAN]: { count: 3, limit: 50, remaining: 47 },
        },
      };

      expect(SubscriptionStatusResponseSchema.safeParse(payload).success).toBe(true);
    });

    it('validates RevenueCatWebhookPayloadSchema structure', async () => {
      const { RevenueCatWebhookPayloadSchema } = await import('../src/subscription.contract.js');

      const webhookData = {
        api_version: '1.0',
        event: {
          id: 'evt_123456789',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_uuid_abc',
          product_id: 'com.calmeter.premium.annual',
          entitlement_id: 'premium_access',
          period_type: 'NORMAL',
          purchased_at_ms: 1731234567000,
          expiration_at_ms: 1762770567000,
          environment: 'SANDBOX',
          store: 'APP_STORE',
          event_timestamp_ms: 1731234567000,
        },
      };

      expect(RevenueCatWebhookPayloadSchema.safeParse(webhookData).success).toBe(true);
    });

    it('validates FeatureLimitExceededErrorSchema', async () => {
      const { FeatureLimitExceededErrorSchema } = await import('../src/subscription.contract.js');
      const { FeatureKey } = await import('@calmeter/shared');

      const err = {
        code: 'FEATURE_LIMIT_EXCEEDED',
        message: 'Daily AI photo scan limit reached.',
        feature: FeatureKey.AI_PHOTO_SCAN,
        limit: 3,
        currentUsage: 3,
        upgradeUrl: '/paywall',
      };

      expect(FeatureLimitExceededErrorSchema.safeParse(err).success).toBe(true);
    });
  });

  describe('Subscriptions, Payments & Entitlements Contracts (Part 12)', () => {
    it('validates SubscriptionStatusResponseSchema', async () => {
      const { SubscriptionStatusResponseSchema } = await import('../src/subscription.contract.js');
      const { SubscriptionTier, SubscriptionStatus, SubscriptionStore, FeatureKey } =
        await import('@calmeter/shared');

      const payload = {
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        store: SubscriptionStore.APP_STORE,
        planId: 'monthly_premium',
        productId: 'com.calmeter.premium.monthly',
        entitlements: ['premium_access'],
        expiresAt: '2026-12-10T12:00:00.000Z',
        autoRenewStatus: true,
        isSandbox: false,
        billingIssue: false,
        cancelReason: null,
        dailyUsage: {
          [FeatureKey.AI_PHOTO_SCAN]: { count: 3, limit: 50, remaining: 47 },
        },
      };

      expect(SubscriptionStatusResponseSchema.safeParse(payload).success).toBe(true);
    });

    it('validates RevenueCatWebhookPayloadSchema structure', async () => {
      const { RevenueCatWebhookPayloadSchema } = await import('../src/subscription.contract.js');

      const webhookData = {
        api_version: '1.0',
        event: {
          id: 'evt_123456789',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user_uuid_abc',
          product_id: 'com.calmeter.premium.annual',
          entitlement_id: 'premium_access',
          period_type: 'NORMAL',
          purchased_at_ms: 1731234567000,
          expiration_at_ms: 1762770567000,
          environment: 'SANDBOX',
          store: 'APP_STORE',
          event_timestamp_ms: 1731234567000,
        },
      };

      expect(RevenueCatWebhookPayloadSchema.safeParse(webhookData).success).toBe(true);
    });

    it('validates FeatureLimitExceededErrorSchema', async () => {
      const { FeatureLimitExceededErrorSchema } = await import('../src/subscription.contract.js');
      const { FeatureKey } = await import('@calmeter/shared');

      const err = {
        code: 'FEATURE_LIMIT_EXCEEDED',
        message: 'Daily AI photo scan limit reached.',
        feature: FeatureKey.AI_PHOTO_SCAN,
        limit: 3,
        currentUsage: 3,
        upgradeUrl: '/paywall',
      };

      expect(FeatureLimitExceededErrorSchema.safeParse(err).success).toBe(true);
    });
  });

  describe('Notifications & Reminders Contracts (Part 13)', () => {
    it('validates RegisterDeviceTokenSchema', async () => {
      const { RegisterDeviceTokenSchema } = await import('../src/notification.contract.js');
      const { DevicePlatform } = await import('@calmeter/shared');

      const payload = {
        token: 'fcm-device-registration-token-valid-length-1234567890',
        platform: DevicePlatform.ANDROID,
        deviceModel: 'Pixel 8 Pro',
        osVersion: 'Android 14',
        appVersion: '1.0.0',
      };

      expect(RegisterDeviceTokenSchema.safeParse(payload).success).toBe(true);
    });

    it('validates NotificationPreferenceSchema defaults and custom reminder times', async () => {
      const { NotificationPreferenceSchema } = await import('../src/notification.contract.js');

      const payload = {
        enabled: true,
        mealReminders: true,
        breakfastReminder: true,
        lunchReminder: true,
        dinnerReminder: true,
        waterReminders: true,
        dailySummary: true,
        weeklySummary: true,
        weightReminders: true,
        coachInsights: true,
        subscriptionUpdates: true,
        breakfastTime: '08:30',
        lunchTime: '13:00',
        dinnerTime: '20:00',
        dailySummaryTime: '21:30',
        weightReminderTime: '08:00',
        weeklySummaryDay: 0,
        waterIntervalHours: 2,
        waterStartTime: '09:00',
        waterEndTime: '21:00',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'Asia/Kolkata',
      };

      const result = NotificationPreferenceSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid time formats for notification preferences', async () => {
      const { NotificationPreferenceSchema } = await import('../src/notification.contract.js');

      const invalid = {
        breakfastTime: '25:00', // invalid hour
      };

      expect(NotificationPreferenceSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('Product Analytics Contracts (Part 13)', () => {
    it('validates TrackAnalyticsEventSchema and BatchAnalyticsEventsSchema', async () => {
      const { TrackAnalyticsEventSchema, BatchAnalyticsEventsSchema } =
        await import('../src/analytics.contract.js');
      const { AnalyticsEventName } = await import('@calmeter/shared');

      const single = {
        eventName: AnalyticsEventName.DIARY_ENTRY_CREATED,
        properties: { mealType: 'LUNCH', calories: 540 },
        devicePlatform: 'ANDROID',
        appVersion: '1.0.0',
        sessionId: 'sess_123',
      };

      expect(TrackAnalyticsEventSchema.safeParse(single).success).toBe(true);

      const batch = {
        events: [single],
      };

      expect(BatchAnalyticsEventsSchema.safeParse(batch).success).toBe(true);
    });
  });

  describe('Operational Metrics Contracts (Part 13)', () => {
    it('validates OperationalMetricsResponseSchema structure', async () => {
      const { OperationalMetricsResponseSchema } = await import('../src/metrics.contract.js');

      const metric = {
        service: 'calmeter-api',
        version: '1.0.0',
        environment: 'test',
        timestamp: '2026-11-10T12:00:00.000Z',
        uptimeSeconds: 3600,
        memoryUsage: {
          heapUsedMb: 64.2,
          heapTotalMb: 128.0,
          rssMb: 180.5,
        },
        httpMetrics: {
          totalRequests: 1500,
          statusCodes: { '200': 1480, '404': 15, '500': 5 },
          averageLatencyMs: 45.2,
          p95LatencyMs: 120.0,
        },
        workerMetrics: {
          activeJobs: 2,
          completedJobs: 140,
          failedJobs: 1,
          waitingJobs: 0,
        },
        aiMetrics: {
          requestCount: 50,
          totalTokens: 15400,
          promptTokens: 12000,
          completionTokens: 3400,
          averageLatencyMs: 650.0,
        },
      };

      expect(OperationalMetricsResponseSchema.safeParse(metric).success).toBe(true);
    });
  });

  describe('Notifications & Reminders Contracts (Part 13)', () => {
    it('validates RegisterDeviceTokenSchema', async () => {
      const { RegisterDeviceTokenSchema } = await import('../src/notification.contract.js');
      const { DevicePlatform } = await import('@calmeter/shared');

      const payload = {
        token: 'fcm-device-registration-token-valid-length-1234567890',
        platform: DevicePlatform.ANDROID,
        deviceModel: 'Pixel 8 Pro',
        osVersion: 'Android 14',
        appVersion: '1.0.0',
      };

      expect(RegisterDeviceTokenSchema.safeParse(payload).success).toBe(true);
    });

    it('validates NotificationPreferenceSchema defaults and custom reminder times', async () => {
      const { NotificationPreferenceSchema } = await import('../src/notification.contract.js');

      const payload = {
        enabled: true,
        mealReminders: true,
        breakfastReminder: true,
        lunchReminder: true,
        dinnerReminder: true,
        waterReminders: true,
        dailySummary: true,
        weeklySummary: true,
        weightReminders: true,
        coachInsights: true,
        subscriptionUpdates: true,
        breakfastTime: '08:30',
        lunchTime: '13:00',
        dinnerTime: '20:00',
        dailySummaryTime: '21:30',
        weightReminderTime: '08:00',
        weeklySummaryDay: 0,
        waterIntervalHours: 2,
        waterStartTime: '09:00',
        waterEndTime: '21:00',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'Asia/Kolkata',
      };

      const result = NotificationPreferenceSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid time formats for notification preferences', async () => {
      const { NotificationPreferenceSchema } = await import('../src/notification.contract.js');

      const invalid = {
        breakfastTime: '25:00', // invalid hour
      };

      expect(NotificationPreferenceSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('Product Analytics Contracts (Part 13)', () => {
    it('validates TrackAnalyticsEventSchema and BatchAnalyticsEventsSchema', async () => {
      const { TrackAnalyticsEventSchema, BatchAnalyticsEventsSchema } =
        await import('../src/analytics.contract.js');
      const { AnalyticsEventName } = await import('@calmeter/shared');

      const single = {
        eventName: AnalyticsEventName.DIARY_ENTRY_CREATED,
        properties: { mealType: 'LUNCH', calories: 540 },
        devicePlatform: 'ANDROID',
        appVersion: '1.0.0',
        sessionId: 'sess_123',
      };

      expect(TrackAnalyticsEventSchema.safeParse(single).success).toBe(true);

      const batch = {
        events: [single],
      };

      expect(BatchAnalyticsEventsSchema.safeParse(batch).success).toBe(true);
    });
  });

  describe('Operational Metrics Contracts (Part 13)', () => {
    it('validates OperationalMetricsResponseSchema structure', async () => {
      const { OperationalMetricsResponseSchema } = await import('../src/metrics.contract.js');

      const metric = {
        service: 'calmeter-api',
        version: '1.0.0',
        environment: 'test',
        timestamp: '2026-11-10T12:00:00.000Z',
        uptimeSeconds: 3600,
        memoryUsage: {
          heapUsedMb: 64.2,
          heapTotalMb: 128.0,
          rssMb: 180.5,
        },
        httpMetrics: {
          totalRequests: 1500,
          statusCodes: { '200': 1480, '404': 15, '500': 5 },
          averageLatencyMs: 45.2,
          p95LatencyMs: 120.0,
        },
        workerMetrics: {
          activeJobs: 2,
          completedJobs: 140,
          failedJobs: 1,
          waitingJobs: 0,
        },
        aiMetrics: {
          requestCount: 50,
          totalTokens: 15400,
          promptTokens: 12000,
          completionTokens: 3400,
          averageLatencyMs: 650.0,
        },
      };

      expect(OperationalMetricsResponseSchema.safeParse(metric).success).toBe(true);
    });
  });

  describe('Web Admin Panel & Operations Contracts (Part 14)', () => {
    it('validates ProvisionAdminInputSchema and UpdateAdminRoleInputSchema', async () => {
      const { ProvisionAdminInputSchema, UpdateAdminRoleInputSchema } =
        await import('../src/admin.contract.js');
      const { AdminRole } = await import('@calmeter/shared');

      const provisionPayload = {
        email: 'ops-lead@calmeter.internal',
        name: 'Operations Lead',
        role: AdminRole.OPERATIONS_ADMIN,
      };

      expect(ProvisionAdminInputSchema.safeParse(provisionPayload).success).toBe(true);

      const updateRolePayload = {
        role: AdminRole.SUPER_ADMIN,
      };

      expect(UpdateAdminRoleInputSchema.safeParse(updateRolePayload).success).toBe(true);
    });

    it('validates AdminDashboardOverviewSchema structure', async () => {
      const { AdminDashboardOverviewSchema } = await import('../src/admin.contract.js');

      const dashboard = {
        business: {
          totalUsers: 12500,
          dailyActiveUsers: 3400,
          weeklyActiveUsers: 7800,
          monthlyActiveUsers: 11200,
          newRegistrationsToday: 145,
          freeUsers: 11000,
          premiumSubscribers: 1500,
          activeSubscriptions: 1480,
          conversionRatePercent: 12.0,
          mrrEstimateUsd: 14800.0,
          churnRatePercent: 2.1,
        },
        product: {
          dailyDiaryEntries: 8900,
          photoScansTotal: 4200,
          barcodeScansTotal: 1800,
          coachMessagesTotal: 3100,
          mealRecommendationsTotal: 950,
        },
        operational: {
          apiUptimeSeconds: 86400,
          avgLatencyMs: 35.2,
          p95LatencyMs: 95.0,
          errorRatePercent: 0.05,
          databaseStatus: 'HEALTHY',
          redisStatus: 'HEALTHY',
          workerActiveJobs: 2,
          workerFailedJobs: 0,
          workerQueueDepth: 1,
          aiTotalTokens: 250000,
          aiEstimatedCostUsd: 12.5,
          aiFailureCount: 1,
        },
        generatedAt: '2026-11-10T12:00:00.000Z',
      };

      expect(AdminDashboardOverviewSchema.safeParse(dashboard).success).toBe(true);
    });

    it('validates CreateRecipeInputSchema and CreateSupportTicketInputSchema', async () => {
      const { CreateRecipeInputSchema, CreateSupportTicketInputSchema } =
        await import('../src/admin.contract.js');
      const { SupportTicketCategory, SupportTicketPriority } = await import('@calmeter/shared');

      const recipe = {
        title: 'High-Protein Paneer Bhurji',
        description: 'Nutritious scrambled cottage cheese with bell peppers and cumin',
        cuisine: 'INDIAN_NORTH',
        dietaryTags: ['VEGETARIAN', 'HIGH_PROTEIN'],
        servings: 2,
        prepTimeMinutes: 10,
        cookTimeMinutes: 15,
        difficulty: 'EASY',
        instructions: [
          'Heat oil in a pan',
          'Saute onions and cumin',
          'Crumble fresh paneer and serve',
        ],
        ingredients: [
          { name: 'Paneer', amount: '200g', calories: 530 },
          { name: 'Onion', amount: '1 medium', calories: 45 },
        ],
        caloriesPerServing: 287.5,
        proteinPerServing: 18.0,
        carbsPerServing: 6.5,
        fatPerServing: 20.0,
        fiberPerServing: 2.0,
        isPublished: true,
      };

      expect(CreateRecipeInputSchema.safeParse(recipe).success).toBe(true);

      const ticket = {
        userEmail: 'user@example.com',
        category: SupportTicketCategory.AI_SCAN_FAILURE,
        priority: SupportTicketPriority.HIGH,
        subject: 'Photo scan failed on masala dosa',
        message: 'The photo scan reported an unrecognized dish with 0 confidence.',
      };

      expect(CreateSupportTicketInputSchema.safeParse(ticket).success).toBe(true);
    });
  });
});
