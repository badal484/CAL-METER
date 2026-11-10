import { describe, it, expect } from 'vitest';
import {
  OnboardingDataSchema,
  UpdateNutritionGoalSchema,
  PresignUploadRequestSchema,
  CommitMealRequestSchema,
  LogWeightSchema,
  FoodServingConversionSchema,
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
} from '@calmeter/shared';

describe('Contracts Runtime Schema Validation', () => {
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

    it('rejects malformed date of birth string', () => {
      const parsed = OnboardingDataSchema.safeParse({
        ...validOnboarding,
        dob: '15/06/1995', // Non-ISO format
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toContain('dob');
      }
    });
  });

  describe('UpdateNutritionGoalSchema', () => {
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

    it('rejects dailyCalories below 500 kcal', () => {
      const parsed = UpdateNutritionGoalSchema.safeParse({
        dailyCalories: 400,
        proteinGrams: 50,
        carbsGrams: 50,
        fatGrams: 10,
      });
      expect(parsed.success).toBe(false);
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
  });

  describe('FoodServingConversionSchema', () => {
    it('validates a food-specific conversion definition', () => {
      const valid = {
        unit: 'katori',
        gramWeight: 200,
        volumeMl: 200,
        provenance: ServingProvenance.ICMR_NIN_IFCT,
        notes: 'Standard Indian 200ml katori',
      };
      const parsed = FoodServingConversionSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects non-positive gramWeight', () => {
      const invalid = {
        unit: 'roti',
        gramWeight: 0,
        provenance: ServingProvenance.USER_CONFIGURED,
      };
      expect(FoodServingConversionSchema.safeParse(invalid).success).toBe(false);
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
  });

  describe('LogWeightSchema', () => {
    it('validates a normal weight reading', () => {
      expect(LogWeightSchema.safeParse({ weightKg: 78.4 }).success).toBe(true);
    });

    it('rejects out of bounds weight (< 30 kg or > 350 kg)', () => {
      expect(LogWeightSchema.safeParse({ weightKg: 25 }).success).toBe(false);
      expect(LogWeightSchema.safeParse({ weightKg: 400 }).success).toBe(false);
    });
  });
});
