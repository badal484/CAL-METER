import { z } from 'zod';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const NutritionGoalSchema = z.object({
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
  createdAt: z.string().datetime(),
});

export const UpdateNutritionGoalSchema = z.object({
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
});

export const RecalculateGoalsRequestSchema = z.object({
  paceKgPerWeek: z.number().finite().positive().max(2.0).optional(),
  activityLevel: z.string().optional(),
});

export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;
export type UpdateNutritionGoal = z.infer<typeof UpdateNutritionGoalSchema>;
export type RecalculateGoalsRequest = z.infer<typeof RecalculateGoalsRequestSchema>;
