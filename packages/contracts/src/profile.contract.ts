import { z } from 'zod';
import {
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
  BiologicalSex,
  calculateAgeFromDob,
  MAXIMUM_SUPPORTED_AGE_YEARS,
} from '@calmeter/shared';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';
import { NutritionGoalDtoSchema } from './goals.contract.js';

export const BiologicalSexSchema = z.nativeEnum(BiologicalSex);
export const GenderSchema = z.nativeEnum(Gender);
export const ActivityLevelSchema = z.nativeEnum(ActivityLevel);
export const PrimaryGoalSchema = z.nativeEnum(PrimaryGoal);
export const DietPreferenceSchema = z.nativeEnum(DietPreference);
export const UnitSystemSchema = z.nativeEnum(UnitSystem);

export const BodyMeasurementsSchema = z.object({
  heightCm: z
    .number()
    .finite()
    .min(100, { message: 'Height must be at least 100 cm.' })
    .max(250, { message: 'Height cannot exceed 250 cm.' }),
  currentWeightKg: z
    .number()
    .finite()
    .min(30, { message: 'Current weight must be at least 30 kg.' })
    .max(350, { message: 'Current weight cannot exceed 350 kg.' }),
  targetWeightKg: z
    .number()
    .finite()
    .min(30, { message: 'Target weight must be at least 30 kg.' })
    .max(350, { message: 'Target weight cannot exceed 350 kg.' })
    .optional(),
});

export const BaseOnboardingDataSchema = BodyMeasurementsSchema.extend({
  name: z.string().trim().min(1).max(100).optional(),
  gender: GenderSchema.default(Gender.PREFER_NOT_TO_SAY),
  biologicalSex: BiologicalSexSchema.optional(),
  dob: IsoDateStringSchema,
  activityLevel: ActivityLevelSchema,
  dietPreference: DietPreferenceSchema.default(DietPreference.ANY),
  primaryGoal: PrimaryGoalSchema,
  paceKgPerWeek: z.number().finite().positive().max(2.0).default(0.5),
  timezone: z.string().min(1).default('Asia/Kolkata'),
  preferredUnits: UnitSystemSchema.default(UnitSystem.METRIC),
  // Optional custom calorie & macro overrides
  customDailyCalories: z.number().int().finite().positive().max(20000).optional(),
  customProteinGrams: z.number().finite().nonnegative().max(1000).optional(),
  customCarbsGrams: z.number().finite().nonnegative().max(2000).optional(),
  customFatGrams: z.number().finite().nonnegative().max(1000).optional(),
  customFiberGrams: z.number().finite().nonnegative().max(300).optional(),
});

export const OnboardingDataSchema = BaseOnboardingDataSchema.refine(
  data => {
    try {
      const age = calculateAgeFromDob(data.dob);
      return age >= 0 && age <= MAXIMUM_SUPPORTED_AGE_YEARS;
    } catch {
      return false;
    }
  },
  {
    message: `Date of birth must correspond to a valid age (0-${MAXIMUM_SUPPORTED_AGE_YEARS} years) and cannot be in the future.`,
    path: ['dob'],
  },
);

export const UserProfileDtoSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: z.string().nullable().optional(),
  gender: GenderSchema,
  biologicalSex: BiologicalSexSchema.nullable().optional(),
  dob: IsoDateStringSchema.nullable().optional(),
  heightCm: z.number().finite().positive(),
  currentWeightKg: z.number().finite().positive(),
  targetWeightKg: z.number().finite().positive(),
  activityLevel: ActivityLevelSchema,
  dietPreference: DietPreferenceSchema,
  primaryGoal: PrimaryGoalSchema,
  paceKgPerWeek: z.number().finite().nonnegative(),
  timezone: z.string().min(1),
  preferredUnits: UnitSystemSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpdateUserProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    gender: GenderSchema.optional(),
    biologicalSex: BiologicalSexSchema.optional(),
    dob: IsoDateStringSchema.optional(),
    heightCm: z.number().finite().min(100).max(250).optional(),
    currentWeightKg: z.number().finite().min(30).max(350).optional(),
    targetWeightKg: z.number().finite().min(30).max(350).optional(),
    activityLevel: ActivityLevelSchema.optional(),
    dietPreference: DietPreferenceSchema.optional(),
    primaryGoal: PrimaryGoalSchema.optional(),
    paceKgPerWeek: z.number().finite().positive().max(2.0).optional(),
    timezone: z.string().min(1).optional(),
    preferredUnits: UnitSystemSchema.optional(),
  })
  .refine(
    data => {
      if (!data.dob) return true;
      try {
        const age = calculateAgeFromDob(data.dob);
        return age >= 0 && age <= MAXIMUM_SUPPORTED_AGE_YEARS;
      } catch {
        return false;
      }
    },
    {
      message: `Date of birth must correspond to a valid age (0-${MAXIMUM_SUPPORTED_AGE_YEARS} years) and cannot be in the future.`,
      path: ['dob'],
    },
  );

export const NutritionCalculationsDtoSchema = z.object({
  bmr: z.number().finite().positive(),
  tdee: z.number().finite().positive(),
  dailyCalories: z.number().int().finite().positive(),
  proteinGrams: z.number().finite().nonnegative(),
  carbsGrams: z.number().finite().nonnegative(),
  fatGrams: z.number().finite().nonnegative(),
  fiberGrams: z.number().finite().nonnegative(),
  dailyDeficitOrSurplus: z.number().finite(),
  paceKgPerWeek: z.number().finite().nonnegative(),
  isBelowBmr: z.boolean(),
  warnings: z.array(z.string()).default([]),
  disclaimers: z.array(z.string()).default([]),
});

export const OnboardingCompleteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    profile: UserProfileDtoSchema,
    goal: NutritionGoalDtoSchema,
    calculations: NutritionCalculationsDtoSchema,
  }),
});

export const UserProfileResponseSchema = z.object({
  success: z.literal(true),
  data: UserProfileDtoSchema,
});

export type BodyMeasurements = z.infer<typeof BodyMeasurementsSchema>;
export type OnboardingData = z.infer<typeof OnboardingDataSchema>;
export type UserProfileDto = z.infer<typeof UserProfileDtoSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
export type NutritionCalculationsDto = z.infer<typeof NutritionCalculationsDtoSchema>;
export type OnboardingCompleteResponse = z.infer<typeof OnboardingCompleteResponseSchema>;
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
