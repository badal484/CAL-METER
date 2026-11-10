import { z } from 'zod';
import { FoodSource } from '@calmeter/shared';
import { UuidSchema, PaginationQuerySchema } from './common.contract.js';
import { FoodServingConversionSchema } from './servings.contract.js';

export const FoodSourceSchema = z.nativeEnum(FoodSource);

export const NutrientProfileSchema = z.object({
  calories: z.number().min(0),
  proteinGrams: z.number().min(0),
  carbsGrams: z.number().min(0),
  fatGrams: z.number().min(0),
  fiberGrams: z.number().min(0).optional(),
  micronutrients: z.record(z.string(), z.number()).optional(),
});

export const FoodItemSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  localNames: z.array(z.string()).default([]),
  brand: z.string().max(255).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  source: FoodSourceSchema,
  servingSize: z.number().positive().default(100),
  servingUnit: z.string().min(1).max(50).default('g'),
  standardWeightGrams: z.number().positive().default(100),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  fiber: z.number().min(0).default(0),
  micronutrients: z.record(z.string(), z.number()).default({}),
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
  servingSize: z.number().positive().default(100),
  servingUnit: z.string().min(1).max(50).default('g'),
  standardWeightGrams: z.number().positive().default(100),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  fiber: z.number().min(0).default(0),
  micronutrients: z.record(z.string(), z.number()).optional(),
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
  servingSize: z.number(),
  servingUnit: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  isVerified: z.boolean(),
});

export const FoodSearchResponseSchema = z.object({
  items: z.array(FoodSearchResultItemSchema),
  total: z.number().int().min(0),
});

export type NutrientProfileDto = z.infer<typeof NutrientProfileSchema>;
export type FoodItemDto = z.infer<typeof FoodItemSchema>;
export type CreateCustomFoodDto = z.infer<typeof CreateCustomFoodSchema>;
export type FoodSearchQuery = z.infer<typeof FoodSearchQuerySchema>;
export type FoodSearchResultItem = z.infer<typeof FoodSearchResultItemSchema>;
export type FoodSearchResponse = z.infer<typeof FoodSearchResponseSchema>;
