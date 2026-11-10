import { z } from 'zod';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const NutritionGoalSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  dailyCalories: z.number().int().min(500).max(10000),
  proteinGrams: z.number().min(0).max(500),
  carbsGrams: z.number().min(0).max(1000),
  fatGrams: z.number().min(0).max(500),
  fiberGrams: z.number().min(0).max(150).default(30),
  waterMl: z.number().int().min(500).max(15000).default(2500),
  effectiveDate: IsoDateStringSchema,
  createdAt: z.string().datetime(),
});

export const UpdateNutritionGoalSchema = z.object({
  dailyCalories: z.number().int().min(500).max(10000),
  proteinGrams: z.number().min(0).max(500),
  carbsGrams: z.number().min(0).max(1000),
  fatGrams: z.number().min(0).max(500),
  fiberGrams: z.number().min(0).max(150).optional(),
  waterMl: z.number().int().min(500).max(15000).optional(),
});

export const RecalculateGoalsRequestSchema = z.object({
  paceKgPerWeek: z.number().min(0.1).max(1.5).optional(),
  activityLevel: z.string().optional(),
});

export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;
export type UpdateNutritionGoal = z.infer<typeof UpdateNutritionGoalSchema>;
export type RecalculateGoalsRequest = z.infer<typeof RecalculateGoalsRequestSchema>;
