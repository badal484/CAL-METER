import { z } from 'zod';
import { ScanStatus } from '@calmeter/shared';
import { UuidSchema } from './common.contract.js';

export const ScanStatusSchema = z.nativeEnum(ScanStatus);

export const PresignUploadRequestSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Image must be JPEG, PNG, or WebP format.',
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, {
      message: 'Image size cannot exceed 10 MB.',
    }),
});

export const PresignUploadResponseSchema = z.object({
  scanId: UuidSchema,
  uploadUrl: z.string().url(),
  storageKey: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
});

export const AnalyzeScanRequestSchema = z.object({
  scanId: UuidSchema,
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).optional(),
});

export const DetectedPortionSchema = z.object({
  quantity: z.number().positive(),
  unit: z.string().min(1),
  estimatedWeightGrams: z.number().positive(),
});

export const DetectedFoodItemSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  regionalName: z.string().optional(),
  cuisine: z.string().optional(),
  cookingMethod: z.string().optional(),
  portion: DetectedPortionSchema,
  confidence: z.number().min(0).max(1),
  visualIndicators: z
    .object({
      oilSheen: z.enum(['DRY', 'MODERATE', 'HEAVY']).optional(),
    })
    .optional(),
  matchedFood: z
    .object({
      id: UuidSchema,
      name: z.string(),
      source: z.string(),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
    })
    .optional(),
});

export const FoodScanResponseSchema = z.object({
  scanId: UuidSchema,
  status: ScanStatusSchema,
  latencyMs: z.number().int().optional(),
  detectedItems: z.array(DetectedFoodItemSchema).default([]),
  totalEstimatedCalories: z.number().optional(),
  uncertaintyNotes: z.array(z.string()).default([]),
});

export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>;
export type PresignUploadResponse = z.infer<typeof PresignUploadResponseSchema>;
export type AnalyzeScanRequest = z.infer<typeof AnalyzeScanRequestSchema>;
export type DetectedFoodItem = z.infer<typeof DetectedFoodItemSchema>;
export type FoodScanResponse = z.infer<typeof FoodScanResponseSchema>;
