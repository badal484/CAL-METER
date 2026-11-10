import { z } from 'zod';
import { FoodSource } from '@calmeter/shared';
import { UuidSchema } from './common.contract.js';
import { FoodServingConversionSchema } from './servings.contract.js';

export const FoodSourceSchema = z.nativeEnum(FoodSource);

/**
 * Detailed nutrient profile for 100g of food.
 *
 * Core rule: Distinguish unknown (null/undefined) from verified zero (0).
 * Never silently coerce missing values into zero.
 */
export const FoodNutrientProfileSchema = z.object({
  id: UuidSchema.optional(),
  foodItemId: UuidSchema.optional(),
  calories: z
    .number()
    .finite({ message: 'Calories must be a finite number.' })
    .nonnegative({ message: 'Calories cannot be negative.' }),
  protein: z
    .number()
    .finite({ message: 'Protein must be a finite number.' })
    .nonnegative({ message: 'Protein cannot be negative.' }),
  carbs: z
    .number()
    .finite({ message: 'Carbohydrates must be a finite number.' })
    .nonnegative({ message: 'Carbohydrates cannot be negative.' }),
  fat: z
    .number()
    .finite({ message: 'Fat must be a finite number.' })
    .nonnegative({ message: 'Fat cannot be negative.' }),
  saturatedFat: z
    .number()
    .finite({ message: 'Saturated fat must be a finite number.' })
    .nonnegative({ message: 'Saturated fat cannot be negative.' })
    .nullable()
    .optional(),
  transFat: z
    .number()
    .finite({ message: 'Trans fat must be a finite number.' })
    .nonnegative({ message: 'Trans fat cannot be negative.' })
    .nullable()
    .optional(),
  fiber: z
    .number()
    .finite({ message: 'Dietary fiber must be a finite number.' })
    .nonnegative({ message: 'Dietary fiber cannot be negative.' })
    .nullable()
    .optional(),
  sugar: z
    .number()
    .finite({ message: 'Total sugar must be a finite number.' })
    .nonnegative({ message: 'Total sugar cannot be negative.' })
    .nullable()
    .optional(),
  addedSugar: z
    .number()
    .finite({ message: 'Added sugar must be a finite number.' })
    .nonnegative({ message: 'Added sugar cannot be negative.' })
    .nullable()
    .optional(),
  sodium: z
    .number()
    .finite({ message: 'Sodium must be a finite number.' })
    .nonnegative({ message: 'Sodium cannot be negative.' })
    .nullable()
    .optional(), // in mg
  cholesterol: z
    .number()
    .finite({ message: 'Cholesterol must be a finite number.' })
    .nonnegative({ message: 'Cholesterol cannot be negative.' })
    .nullable()
    .optional(), // in mg
  potassium: z
    .number()
    .finite({ message: 'Potassium must be a finite number.' })
    .nonnegative({ message: 'Potassium cannot be negative.' })
    .nullable()
    .optional(), // in mg
  calcium: z
    .number()
    .finite({ message: 'Calcium must be a finite number.' })
    .nonnegative({ message: 'Calcium cannot be negative.' })
    .nullable()
    .optional(), // in mg
  iron: z
    .number()
    .finite({ message: 'Iron must be a finite number.' })
    .nonnegative({ message: 'Iron cannot be negative.' })
    .nullable()
    .optional(), // in mg
  vitaminD: z
    .number()
    .finite({ message: 'Vitamin D must be a finite number.' })
    .nonnegative({ message: 'Vitamin D cannot be negative.' })
    .nullable()
    .optional(), // in mcg
  vitaminB12: z
    .number()
    .finite({ message: 'Vitamin B12 must be a finite number.' })
    .nonnegative({ message: 'Vitamin B12 cannot be negative.' })
    .nullable()
    .optional(), // in mcg
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).default({}),
});

/**
 * Backward-compatible macro schema for existing services.
 */
export const NutrientProfileSchema = z.object({
  calories: z.number().finite().nonnegative(),
  proteinGrams: z.number().finite().nonnegative(),
  carbsGrams: z.number().finite().nonnegative(),
  fatGrams: z.number().finite().nonnegative(),
  fiberGrams: z.number().finite().nonnegative().optional(),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).optional(),
});

export const FoodCategorySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

export const FoodAliasSchema = z.object({
  id: UuidSchema.optional(),
  foodItemId: UuidSchema.optional(),
  alias: z.string().min(1).max(255),
  language: z.string().max(20).nullable().optional(),
  isPrimary: z.boolean().default(false),
});

export const FoodIngredientSchema = z.object({
  id: UuidSchema.optional(),
  parentFoodItemId: UuidSchema.optional(),
  ingredientFoodItemId: UuidSchema.nullable().optional(),
  ingredientName: z.string().min(1).max(255),
  gramWeight: z.number().finite().positive().nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
  orderIndex: z.number().int().nonnegative().default(0),
});

export const FoodDataSourceSchema = z.object({
  id: UuidSchema.optional(),
  source: FoodSourceSchema,
  name: z.string().min(1).max(100),
  license: z.string().min(1).max(150),
  licenseUrl: z.string().url().nullable().optional(),
  attribution: z.string().max(500).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const FoodServingItemSchema = z.object({
  id: UuidSchema.optional(),
  foodItemId: UuidSchema.optional(),
  unitName: z.string().min(1).max(50),
  servingDescription: z.string().max(100).nullable().optional(),
  gramWeight: z.number().finite().positive(),
  mlVolume: z.number().finite().positive().nullable().optional(),
  provenance: z.string().default('USER_CONFIGURED'),
  isDefault: z.boolean().default(false),
});

export const FoodItemSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  localNames: z.array(z.string()).default([]),
  brand: z.string().max(255).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  source: FoodSourceSchema,
  externalId: z.string().max(100).nullable().optional(),
  cuisine: z.string().max(50).nullable().optional(),
  state: z.string().max(30).nullable().optional(),
  prepMethod: z.string().max(50).nullable().optional(),
  isCustom: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  confidenceScore: z.number().finite().min(0).max(1).nullable().optional(),
  servingSize: z.number().finite().positive().default(100),
  servingUnit: z.string().min(1).max(50).default('g'),
  standardWeightGrams: z.number().finite().positive().default(100),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().default(0),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).default({}),
  categoryId: UuidSchema.nullable().optional(),
  createdByUserId: UuidSchema.nullable().optional(),
  servingConversions: z.array(FoodServingConversionSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const FoodItemDetailSchema = FoodItemSchema.extend({
  category: FoodCategorySchema.nullable().optional(),
  nutrientProfile: FoodNutrientProfileSchema.nullable().optional(),
  aliases: z.array(FoodAliasSchema).default([]),
  recipeIngredients: z.array(FoodIngredientSchema).default([]),
  dataSource: FoodDataSourceSchema.nullable().optional(),
});

export const CreateCustomFoodSchema = z.object({
  name: z.string().min(1, 'Food name is required.').max(255),
  localNames: z.array(z.string()).optional(),
  brand: z.string().max(255).optional(),
  barcode: z.string().max(64).optional(),
  cuisine: z.string().max(50).optional(),
  state: z.string().max(30).optional(),
  prepMethod: z.string().max(50).optional(),
  servingSize: z.number().finite().positive().default(100),
  servingUnit: z.string().min(1).max(50).default('g'),
  standardWeightGrams: z.number().finite().positive().default(100),
  calories: z.number().finite().nonnegative({ message: 'Calories must be non-negative.' }),
  protein: z.number().finite().nonnegative({ message: 'Protein must be non-negative.' }),
  carbs: z.number().finite().nonnegative({ message: 'Carbohydrates must be non-negative.' }),
  fat: z.number().finite().nonnegative({ message: 'Fat must be non-negative.' }),
  fiber: z.number().finite().nonnegative().default(0),
  saturatedFat: z.number().finite().nonnegative().nullable().optional(),
  transFat: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  addedSugar: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
  cholesterol: z.number().finite().nonnegative().nullable().optional(),
  potassium: z.number().finite().nonnegative().nullable().optional(),
  calcium: z.number().finite().nonnegative().nullable().optional(),
  iron: z.number().finite().nonnegative().nullable().optional(),
  vitaminD: z.number().finite().nonnegative().nullable().optional(),
  vitaminB12: z.number().finite().nonnegative().nullable().optional(),
  micronutrients: z.record(z.string(), z.number().finite().nonnegative()).optional(),
  servingConversions: z.array(FoodServingConversionSchema).optional(),
  aliases: z
    .array(
      z.object({
        alias: z.string().min(1).max(255),
        language: z.string().max(20).optional(),
      }),
    )
    .optional(),
});

export const UpdateCustomFoodSchema = CreateCustomFoodSchema.partial();

export const FoodSearchQuerySchema = z.object({
  q: z.string().max(100).optional(),
  barcode: z.string().max(64).optional(),
  categoryId: UuidSchema.optional(),
  cuisine: z.string().max(50).optional(),
  source: FoodSourceSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'calories', 'protein', 'createdAt', 'relevance']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const FoodSearchResultItemSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  localNames: z.array(z.string()).default([]),
  brand: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  source: FoodSourceSchema,
  cuisine: z.string().nullable().optional(),
  servingSize: z.number().finite().positive(),
  servingUnit: z.string(),
  standardWeightGrams: z.number().finite().positive().default(100),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().default(0),
  isVerified: z.boolean(),
  isCustom: z.boolean().default(false),
  category: z
    .object({
      id: UuidSchema,
      name: z.string(),
      slug: z.string(),
    })
    .nullable()
    .optional(),
  servingConversions: z.array(FoodServingConversionSchema).default([]),
});

export const FoodSearchResponseSchema = z.object({
  items: z.array(FoodSearchResultItemSchema),
  total: z.number().int().finite().min(0),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
  totalPages: z.number().int().nonnegative().default(1),
});

export type FoodNutrientProfileDto = z.infer<typeof FoodNutrientProfileSchema>;
export type NutrientProfileDto = z.infer<typeof NutrientProfileSchema>;
export type FoodCategoryDto = z.infer<typeof FoodCategorySchema>;
export type FoodAliasDto = z.infer<typeof FoodAliasSchema>;
export type FoodIngredientDto = z.infer<typeof FoodIngredientSchema>;
export type FoodDataSourceDto = z.infer<typeof FoodDataSourceSchema>;
export type FoodServingItemDto = z.infer<typeof FoodServingItemSchema>;
export type FoodItemDto = z.infer<typeof FoodItemSchema>;
export type FoodItemDetailDto = z.infer<typeof FoodItemDetailSchema>;
export type CreateCustomFoodDto = z.infer<typeof CreateCustomFoodSchema>;
export type UpdateCustomFoodDto = z.infer<typeof UpdateCustomFoodSchema>;
export type FoodSearchQuery = z.infer<typeof FoodSearchQuerySchema>;
export type FoodSearchResultItem = z.infer<typeof FoodSearchResultItemSchema>;
export type FoodSearchResponse = z.infer<typeof FoodSearchResponseSchema>;
