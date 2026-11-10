import { z } from 'zod';
import { FoodSource } from '@calmeter/shared';
import { UuidSchema, PaginationQuerySchema } from './common.contract.js';
import { FoodServingConversionSchema } from './servings.contract.js';

export const FoodSourceSchema = z.nativeEnum(FoodSource);

export const NutrientProfileSchema = z.object({
  calories: z.number().finite().nonnegative(),
  proteinGrams: z.number().finite().nonnegative(),
  carbsGrams: z.number().finite().nonnegative(),
  fatGrams: z.number().finite().nonnegative(),
  fiberGrams: z.number().finite().nonnegative().optional(),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).optional(),
});

export const FoodItemSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  localNames: z.array(z.string()).default([]),
  brand: z.string().max(255).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  source: FoodSourceSchema,
  servingSize: z.number().finite().positive().default(100),
  servingUnit: z.string().min(1).max(50).default('g'),
  standardWeightGrams: z.number().finite().positive().default(100),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().default(0),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).default({}),
  isVerified: z.boolean().default(false),
  createdByUserId: UuidSchema.nullable().optional(),
  servingConversions: z.array(FoodServingConversionSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateCustomFoodSchema = z.object({
  name: z.string().min(1).max(255),
  localNames: z.array(z.string()).optional(),
  brand: z.string().max(255).optional(),
  servingSize: z.number().finite().positive().default(100),
  servingUnit: z.string().min(1).max(50).default('g'),
  standardWeightGrams: z.number().finite().positive().default(100),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().default(0),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).optional(),
  servingConversions: z.array(FoodServingConversionSchema).optional(),
});

export const FoodSearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().min(1).max(100),
  source: FoodSourceSchema.optional(),
});

export const FoodSearchResultItemSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  source: FoodSourceSchema,
  servingSize: z.number().finite().positive(),
  servingUnit: z.string(),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  isVerified: z.boolean(),
});

export const FoodSearchResponseSchema = z.object({
  items: z.array(FoodSearchResultItemSchema),
  total: z.number().int().finite().min(0),
});

export type NutrientProfileDto = z.infer<typeof NutrientProfileSchema>;
export type FoodItemDto = z.infer<typeof FoodItemSchema>;
export type CreateCustomFoodDto = z.infer<typeof CreateCustomFoodSchema>;
export type FoodSearchQuery = z.infer<typeof FoodSearchQuerySchema>;
export type FoodSearchResultItem = z.infer<typeof FoodSearchResultItemSchema>;
export type FoodSearchResponse = z.infer<typeof FoodSearchResponseSchema>;
