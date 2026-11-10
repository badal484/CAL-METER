import { z } from 'zod';
import { GoalStatus, PrimaryGoal, BiologicalSex, Gender, ActivityLevel } from '@calmeter/shared';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const GoalStatusSchema = z.nativeEnum(GoalStatus);

export const NutritionGoalDtoSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  dailyCalories: z
    .number()
    .int()
    .finite()
    .positive({ message: 'Daily calories must be a positive integer.' })
    .max(20000, { message: 'Daily calories exceed maximum physiological bounds.' }),
  proteinGrams: z.number().finite().nonnegative().max(1000),
  carbsGrams: z.number().finite().nonnegative().max(2000),
  fatGrams: z.number().finite().nonnegative().max(1000),
  fiberGrams: z.number().finite().nonnegative().max(300).default(30),
  waterMl: z.number().int().finite().positive().max(30000).default(2500),
  effectiveDate: IsoDateStringSchema,
  status: GoalStatusSchema.default(GoalStatus.ACTIVE),
  primaryGoal: z.nativeEnum(PrimaryGoal).nullable().optional(),
  targetWeightKg: z.number().finite().positive().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const NutritionGoalSchema = NutritionGoalDtoSchema;

export const CreateNutritionGoalRequestSchema = z.object({
  dailyCalories: z
    .number()
    .int()
    .finite()
    .positive({ message: 'Daily calories must be a positive integer.' })
    .max(20000, { message: 'Daily calories exceed maximum physiological bounds.' }),
  proteinGrams: z.number().finite().nonnegative().max(1000),
  carbsGrams: z.number().finite().nonnegative().max(2000),
  fatGrams: z.number().finite().nonnegative().max(1000),
  fiberGrams: z.number().finite().nonnegative().max(300).optional(),
  waterMl: z.number().int().finite().positive().max(30000).optional(),
  effectiveDate: IsoDateStringSchema.optional(),
  primaryGoal: z.nativeEnum(PrimaryGoal).optional(),
  targetWeightKg: z.number().finite().positive().max(350).optional(),
});

export const UpdateNutritionGoalSchema = z.object({
  dailyCalories: z
    .number()
    .int()
    .finite()
    .positive({ message: 'Daily calories must be a positive integer.' })
    .max(20000, { message: 'Daily calories exceed maximum physiological bounds.' })
    .optional(),
  proteinGrams: z.number().finite().nonnegative().max(1000).optional(),
  carbsGrams: z.number().finite().nonnegative().max(2000).optional(),
  fatGrams: z.number().finite().nonnegative().max(1000).optional(),
  fiberGrams: z.number().finite().nonnegative().max(300).optional(),
  waterMl: z.number().int().finite().positive().max(30000).optional(),
  status: GoalStatusSchema.optional(),
  primaryGoal: z.nativeEnum(PrimaryGoal).optional(),
  targetWeightKg: z.number().finite().positive().max(350).optional(),
});

export const RecalculateGoalsRequestSchema = z.object({
  heightCm: z.number().finite().min(100).max(250).optional(),
  currentWeightKg: z.number().finite().min(30).max(350).optional(),
  targetWeightKg: z.number().finite().min(30).max(350).optional(),
  dob: IsoDateStringSchema.optional(),
  biologicalSex: z.nativeEnum(BiologicalSex).optional(),
  gender: z.nativeEnum(Gender).optional(),
  activityLevel: z.nativeEnum(ActivityLevel).optional(),
  primaryGoal: z.nativeEnum(PrimaryGoal).optional(),
  paceKgPerWeek: z.number().finite().positive().max(2.0).optional(),
  customCalorieOverride: z.number().int().finite().positive().max(20000).optional(),
  customProteinGrams: z.number().finite().nonnegative().max(1000).optional(),
  customCarbsGrams: z.number().finite().nonnegative().max(2000).optional(),
  customFatGrams: z.number().finite().nonnegative().max(1000).optional(),
  customFiberGrams: z.number().finite().nonnegative().max(300).optional(),
});

export const RecalculateGoalsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    bmr: z.number().finite().positive(),
    tdee: z.number().finite().positive(),
    suggestedCalories: z.number().int().finite().positive(),
    proteinGrams: z.number().finite().nonnegative(),
    carbsGrams: z.number().finite().nonnegative(),
    fatGrams: z.number().finite().nonnegative(),
    fiberGrams: z.number().finite().nonnegative(),
    dailyDeficitOrSurplus: z.number().finite(),
    paceKgPerWeek: z.number().finite().nonnegative(),
    isBelowBmr: z.boolean(),
    warnings: z.array(z.string()).default([]),
    disclaimers: z.array(z.string()).default([]),
  }),
});

export const CurrentGoalResponseSchema = z.object({
  success: z.literal(true),
  data: NutritionGoalDtoSchema.nullable(),
});

export const GoalHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(NutritionGoalDtoSchema),
});

export type NutritionGoalDto = z.infer<typeof NutritionGoalDtoSchema>;
export type NutritionGoal = NutritionGoalDto;
export type CreateNutritionGoalRequest = z.infer<typeof CreateNutritionGoalRequestSchema>;
export type UpdateNutritionGoal = z.infer<typeof UpdateNutritionGoalSchema>;
export type RecalculateGoalsRequest = z.infer<typeof RecalculateGoalsRequestSchema>;
export type RecalculateGoalsResponse = z.infer<typeof RecalculateGoalsResponseSchema>;
export type CurrentGoalResponse = z.infer<typeof CurrentGoalResponseSchema>;
export type GoalHistoryResponse = z.infer<typeof GoalHistoryResponseSchema>;
