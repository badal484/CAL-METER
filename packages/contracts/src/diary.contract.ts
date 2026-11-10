import { z } from 'zod';
import { MealType, LoggedMethod } from '@calmeter/shared';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const MealTypeSchema = z.nativeEnum(MealType);
export const LoggedMethodSchema = z.nativeEnum(LoggedMethod);

export const MealFoodItemSchema = z.object({
  id: UuidSchema,
  mealEntryId: UuidSchema,
  foodItemId: UuidSchema.nullable().optional(),
  foodName: z.string().min(1).max(255),
  portionAmount: z.number().positive(),
  servingUnit: z.string().min(1).max(50),
  gramWeight: z.number().positive(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  loggedMethod: LoggedMethodSchema.default(LoggedMethod.SEARCH),
  createdAt: z.string().datetime(),
});

export const LogMealItemRequestSchema = z.object({
  foodItemId: UuidSchema.optional(),
  foodName: z.string().min(1).max(255),
  portionAmount: z.number().positive(),
  servingUnit: z.string().min(1).max(50),
  gramWeight: z.number().positive(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  confidenceScore: z.number().min(0).max(1).optional(),
  loggedMethod: LoggedMethodSchema.default(LoggedMethod.SEARCH),
});

export const CommitMealRequestSchema = z.object({
  date: IsoDateStringSchema,
  mealType: MealTypeSchema,
  notes: z.string().max(500).optional(),
  items: z
    .array(LogMealItemRequestSchema)
    .min(1, { message: 'Must include at least one food item.' }),
});

export const MealEntrySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  date: IsoDateStringSchema,
  mealType: MealTypeSchema,
  loggedAt: z.string().datetime(),
  notes: z.string().nullable().optional(),
  totalCalories: z.number().min(0),
  totalProtein: z.number().min(0),
  totalCarbs: z.number().min(0),
  totalFat: z.number().min(0),
  items: z.array(MealFoodItemSchema).default([]),
});

export const MacroProgressSchema = z.object({
  consumed: z.number().min(0),
  target: z.number().min(0),
});

export const DailyNutritionSummarySchema = z.object({
  date: IsoDateStringSchema,
  calorieGoal: z.number().int().min(0),
  caloriesConsumed: z.number().min(0),
  caloriesRemaining: z.number(),
  macros: z.object({
    protein: MacroProgressSchema,
    carbs: MacroProgressSchema,
    fat: MacroProgressSchema,
    fiber: MacroProgressSchema.optional(),
  }),
  meals: z.array(MealEntrySchema).default([]),
});

export type MealTypeEnum = z.infer<typeof MealTypeSchema>;
export type LoggedMethodEnum = z.infer<typeof LoggedMethodSchema>;
export type MealFoodItemDto = z.infer<typeof MealFoodItemSchema>;
export type LogMealItemRequest = z.infer<typeof LogMealItemRequestSchema>;
export type CommitMealRequest = z.infer<typeof CommitMealRequestSchema>;
export type MealEntryDto = z.infer<typeof MealEntrySchema>;
export type DailyNutritionSummary = z.infer<typeof DailyNutritionSummarySchema>;
