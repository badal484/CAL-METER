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
  portionAmount: z.number().finite().positive(),
  servingUnit: z.string().min(1).max(50),
  gramWeight: z.number().finite().positive(),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).nullable().optional(),
  scanId: UuidSchema.nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
  confidenceScore: z.number().finite().min(0).max(1).nullable().optional(),
  loggedMethod: LoggedMethodSchema.default(LoggedMethod.SEARCH),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const LogMealItemRequestSchema = z.object({
  foodItemId: UuidSchema.optional(),
  foodName: z.string().min(1).max(255),
  portionAmount: z.number().finite().positive(),
  servingUnit: z.string().min(1).max(50),
  gramWeight: z.number().finite().positive().optional(),
  calories: z.number().finite().nonnegative().optional(),
  protein: z.number().finite().nonnegative().optional(),
  carbs: z.number().finite().nonnegative().optional(),
  fat: z.number().finite().nonnegative().optional(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).optional(),
  confidenceScore: z.number().finite().min(0).max(1).optional(),
  loggedMethod: LoggedMethodSchema.default(LoggedMethod.SEARCH),
  scanId: UuidSchema.optional(),
  notes: z.string().max(255).optional(),
});

export const CommitMealRequestSchema = z.object({
  date: IsoDateStringSchema,
  mealType: MealTypeSchema,
  notes: z.string().max(500).optional(),
  items: z
    .array(LogMealItemRequestSchema)
    .min(1, { message: 'Must include at least one food item.' }),
});

export const CreateDiaryEntryRequestSchema = CommitMealRequestSchema;

export const UpdateMealFoodItemRequestSchema = z
  .object({
    portionAmount: z.number().finite().positive().optional(),
    servingUnit: z.string().min(1).max(50).optional(),
    gramWeight: z.number().finite().positive().optional(),
    foodItemId: UuidSchema.optional(),
    foodName: z.string().min(1).max(255).optional(),
    mealType: MealTypeSchema.optional(),
    date: IsoDateStringSchema.optional(),
    notes: z.string().max(255).nullable().optional(),
  })
  .refine(
    data =>
      data.portionAmount !== undefined ||
      data.servingUnit !== undefined ||
      data.gramWeight !== undefined ||
      data.foodItemId !== undefined ||
      data.foodName !== undefined ||
      data.mealType !== undefined ||
      data.date !== undefined ||
      data.notes !== undefined,
    {
      message: 'At least one field must be provided to update a diary item.',
    },
  );

export const MealEntrySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  date: IsoDateStringSchema,
  mealType: MealTypeSchema,
  loggedAt: z.string().datetime(),
  notes: z.string().nullable().optional(),
  totalCalories: z.number().finite().nonnegative(),
  totalProtein: z.number().finite().nonnegative(),
  totalCarbs: z.number().finite().nonnegative(),
  totalFat: z.number().finite().nonnegative(),
  totalFiber: z.number().finite().nonnegative().nullable().optional(),
  totalSugar: z.number().finite().nonnegative().nullable().optional(),
  totalSodium: z.number().finite().nonnegative().nullable().optional(),
  items: z.array(MealFoodItemSchema).default([]),
});

export const MacroProgressSchema = z.object({
  consumed: z.number().finite().nonnegative(),
  target: z.number().finite().nonnegative(),
  remaining: z.number().finite().optional(),
});

export const DailyNutrientTotalsSchema = z.object({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
});

export const DailyNutritionSummarySchema = z.object({
  date: IsoDateStringSchema,
  calorieGoal: z.number().int().finite().nonnegative(),
  caloriesConsumed: z.number().finite().nonnegative(),
  caloriesRemaining: z.number().finite(),
  macros: z.object({
    protein: MacroProgressSchema,
    carbs: MacroProgressSchema,
    fat: MacroProgressSchema,
    fiber: MacroProgressSchema.optional(),
  }),
  totals: DailyNutrientTotalsSchema.optional(),
  meals: z.array(MealEntrySchema).default([]),
});

export const DiaryDetailResponseSchema = z.object({
  date: IsoDateStringSchema,
  meals: z.array(MealEntrySchema),
  totals: DailyNutrientTotalsSchema,
});

export type MealTypeEnum = z.infer<typeof MealTypeSchema>;
export type LoggedMethodEnum = z.infer<typeof LoggedMethodSchema>;
export type MealFoodItemDto = z.infer<typeof MealFoodItemSchema>;
export type LogMealItemRequest = z.infer<typeof LogMealItemRequestSchema>;
export type CommitMealRequest = z.infer<typeof CommitMealRequestSchema>;
export type CreateDiaryEntryRequest = z.infer<typeof CreateDiaryEntryRequestSchema>;
export type UpdateMealFoodItemRequest = z.infer<typeof UpdateMealFoodItemRequestSchema>;
export type MealEntryDto = z.infer<typeof MealEntrySchema>;
export type DailyNutrientTotals = z.infer<typeof DailyNutrientTotalsSchema>;
export type DailyNutritionSummary = z.infer<typeof DailyNutritionSummarySchema>;
export type DiaryDetailResponse = z.infer<typeof DiaryDetailResponseSchema>;
