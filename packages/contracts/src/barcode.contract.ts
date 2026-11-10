import { z } from 'zod';
import { BarcodeFormat, DataQuality } from '@calmeter/shared';
import { UuidSchema } from './common.contract.js';
import { FoodServingConversionSchema } from './servings.contract.js';
import { FoodSourceSchema } from './foods.contract.js';

export const BarcodeFormatSchema = z.nativeEnum(BarcodeFormat);
export const DataQualitySchema = z.nativeEnum(DataQuality);

export const BarcodeParamSchema = z.object({
  barcode: z
    .string()
    .min(1, { message: 'Barcode is required.' })
    .max(64, { message: 'Barcode cannot exceed 64 characters.' })
    .transform(val => val.replace(/[\s\-_]/g, '').trim()),
});

export const ManualBarcodeLookupRequestSchema = z.object({
  barcode: z
    .string()
    .min(1, { message: 'Barcode is required.' })
    .max(64, { message: 'Barcode cannot exceed 64 characters.' })
    .transform(val => val.replace(/[\s\-_]/g, '').trim()),
});

export const PackagedProductNutrientsSchema = z.object({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  saturatedFat: z.number().finite().nonnegative().nullable().optional(),
  transFat: z.number().finite().nonnegative().nullable().optional(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  addedSugar: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(), // mg
  cholesterol: z.number().finite().nonnegative().nullable().optional(), // mg
  potassium: z.number().finite().nonnegative().nullable().optional(), // mg
  calcium: z.number().finite().nonnegative().nullable().optional(), // mg
  iron: z.number().finite().nonnegative().nullable().optional(), // mg
  vitaminD: z.number().finite().nonnegative().nullable().optional(), // mcg
  vitaminB12: z.number().finite().nonnegative().nullable().optional(), // mcg
  micronutrients: z.record(z.string(), z.number().finite()).default({}),
});

export const PackagedProductDtoSchema = z.object({
  id: UuidSchema,
  barcode: z.string(),
  additionalBarcodes: z.array(z.string()).default([]),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  categories: z.array(z.string()).default([]),
  countries: z.array(z.string()).default([]),
  ingredientsText: z.string().nullable().optional(),
  allergens: z.array(z.string()).default([]),
  servingSize: z.number().finite().positive(),
  servingUnit: z.string(),
  standardWeightGrams: z.number().finite().positive().default(100),
  netWeightGrams: z.number().finite().positive().nullable().optional(),
  isLiquid: z.boolean().default(false),
  nutrientsPer100g: PackagedProductNutrientsSchema,
  nutrientsPerServing: PackagedProductNutrientsSchema.nullable().optional(),
  servingConversions: z.array(FoodServingConversionSchema).default([]),
  source: FoodSourceSchema,
  attribution: z.string(),
  license: z.string(),
  isVerified: z.boolean(),
  dataQuality: DataQualitySchema,
  missingNutrients: z.array(z.string()).default([]),
});

export const BarcodeLookupResponseSchema = z.object({
  success: z.literal(true),
  data: PackagedProductDtoSchema,
});

export type BarcodeParam = z.infer<typeof BarcodeParamSchema>;
export type ManualBarcodeLookupRequest = z.infer<typeof ManualBarcodeLookupRequestSchema>;
export type PackagedProductNutrients = z.infer<typeof PackagedProductNutrientsSchema>;
export type PackagedProductDto = z.infer<typeof PackagedProductDtoSchema>;
export type BarcodeLookupResponse = z.infer<typeof BarcodeLookupResponseSchema>;
