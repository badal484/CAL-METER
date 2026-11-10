import { z } from 'zod';
import { ScanStatus, MealType } from '@calmeter/shared';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const ScanStatusSchema = z.nativeEnum(ScanStatus);
export const ScanMealTypeSchema = z.nativeEnum(MealType);

export const SupportedImageMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp'], {
  message: 'Image must be JPEG, PNG, or WebP format.',
});

export const CreateScanRequestSchema = z.object({
  mimeType: SupportedImageMimeTypeSchema,
  fileSizeBytes: z
    .number()
    .int()
    .finite()
    .positive()
    .max(10 * 1024 * 1024, {
      message: 'Image size cannot exceed 10 MB.',
    })
    .optional(),
  mealType: ScanMealTypeSchema.optional(),
});

export const CreateScanResponseSchema = z.object({
  scanId: UuidSchema,
  status: ScanStatusSchema,
  storageKey: z.string().min(1),
  uploadUrl: z.string().min(1),
  expiresInSeconds: z.number().int().finite().positive(),
});

// Backward-compatibility aliases for Part 4 contract tests
export const PresignUploadRequestSchema = z.object({
  contentType: SupportedImageMimeTypeSchema,
  fileSizeBytes: z
    .number()
    .int()
    .finite()
    .positive()
    .max(10 * 1024 * 1024, {
      message: 'Image size cannot exceed 10 MB.',
    }),
});

export const PresignUploadResponseSchema = z.object({
  scanId: UuidSchema,
  uploadUrl: z.string().min(1),
  storageKey: z.string().min(1),
  expiresInSeconds: z.number().int().finite().positive(),
});

export const AnalyzeScanRequestSchema = z.object({
  scanId: UuidSchema,
  mealType: ScanMealTypeSchema.optional(),
});

export const ProcessScanResponseSchema = z.object({
  scanId: UuidSchema,
  status: ScanStatusSchema,
  message: z.string(),
});

export const PortionEstimateSchema = z.object({
  quantity: z.number().finite().positive(),
  unit: z.string().min(1),
  estimatedGrams: z.number().finite().positive(),
  minGrams: z.number().finite().positive().optional(),
  maxGrams: z.number().finite().positive().optional(),
  servingDescription: z.string().optional(),
  confidence: z.number().finite().min(0).max(1).default(0.8),
});

export const FoodMatchOptionSchema = z.object({
  foodItemId: UuidSchema,
  name: z.string(),
  localNames: z.array(z.string()).default([]),
  brand: z.string().nullable().default(null),
  cuisine: z.string().nullable().default(null),
  isVerified: z.boolean().default(false),
  isCustom: z.boolean().default(false),
  score: z.number().finite().min(0).max(1),
  source: z.string(),
  servingConversions: z
    .array(
      z.object({
        id: UuidSchema,
        unitName: z.string(),
        servingDescription: z.string().nullable().optional(),
        gramWeight: z.number().finite().positive(),
        isDefault: z.boolean().default(false),
      }),
    )
    .default([]),
});

export const MatchStatusSchema = z.enum([
  'EXACT_MATCH',
  'HIGH_CONFIDENCE',
  'AMBIGUOUS',
  'LOW_CONFIDENCE',
  'NO_MATCH',
]);

export const CalculatedItemNutrientsSchema = z.object({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  micronutrients: z.record(z.number().finite().nullable()).optional(),
  provenance: z.string().default('CALCULATED_BACKEND'),
});

export const FoodCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  alternateNames: z.array(z.string()).default([]),
  category: z.string().default('other'),
  cuisine: z.string().optional(),
  preparationMethod: z.string().optional(),
  rawCookedState: z.enum(['RAW', 'COOKED', 'FERMENTED', 'PROCESSED']).optional(),
  components: z.array(z.string()).default([]),
  portion: PortionEstimateSchema,
  confidence: z.number().finite().min(0).max(1),
  matchStatus: MatchStatusSchema,
  primaryMatch: FoodMatchOptionSchema.nullable().optional(),
  alternativeMatches: z.array(FoodMatchOptionSchema).default([]),
  calculatedNutrients: CalculatedItemNutrientsSchema.optional(),
  uncertaintyReason: z.string().optional(),
  visualIndicators: z
    .object({
      oilSheen: z.enum(['DRY', 'MODERATE', 'HEAVY']).optional(),
      apparentSizeCm: z.number().finite().positive().optional(),
    })
    .optional(),
});

// Legacy DetectedFoodItemSchema for backward compatibility
export const DetectedPortionSchema = z.object({
  quantity: z.number().finite().positive(),
  unit: z.string().min(1),
  estimatedWeightGrams: z.number().finite().positive(),
});

export const DetectedFoodItemSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  regionalName: z.string().optional(),
  cuisine: z.string().optional(),
  cookingMethod: z.string().optional(),
  portion: DetectedPortionSchema,
  confidence: z.number().finite().min(0).max(1),
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
      calories: z.number().finite().nonnegative(),
      protein: z.number().finite().nonnegative(),
      carbs: z.number().finite().nonnegative(),
      fat: z.number().finite().nonnegative(),
    })
    .optional(),
});

export const CalculatedNutritionSummarySchema = z.object({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  micronutrients: z.record(z.number().finite().nullable()).optional(),
  itemCount: z.number().int().nonnegative(),
});

export const CorrectionItemSchema = z.object({
  candidateId: z.string().min(1),
  action: z.enum(['UPDATE', 'REMOVE', 'ADD']),
  name: z.string().optional(),
  matchedFoodId: UuidSchema.optional(),
  portion: z
    .object({
      quantity: z.number().finite().positive(),
      unit: z.string().min(1),
      gramWeight: z.number().finite().positive(),
    })
    .optional(),
});

export const SubmitScanCorrectionSchema = z.object({
  items: z.array(CorrectionItemSchema).min(1, 'At least one correction item is required.'),
});

export const ConfirmScanRequestSchema = z.object({
  mealType: ScanMealTypeSchema.optional(),
  date: IsoDateStringSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const ConfirmScanResponseSchema = z.object({
  scanId: UuidSchema,
  status: ScanStatusSchema,
  mealEntryId: UuidSchema,
  totalCalories: z.number().finite().nonnegative(),
  totalProtein: z.number().finite().nonnegative(),
  totalCarbs: z.number().finite().nonnegative(),
  totalFat: z.number().finite().nonnegative(),
  itemCount: z.number().int().positive(),
  confirmedAt: z.string(),
});

export const CancelScanResponseSchema = z.object({
  scanId: UuidSchema,
  status: ScanStatusSchema,
  message: z.string(),
  cancelledAt: z.string(),
});

export const ScanDetailResponseSchema = z.object({
  scanId: UuidSchema,
  userId: UuidSchema,
  status: ScanStatusSchema,
  storageKey: z.string(),
  mimeType: z.string().nullable().optional(),
  fileSizeBytes: z.number().nullable().optional(),
  imageWidth: z.number().nullable().optional(),
  imageHeight: z.number().nullable().optional(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  detectedItems: z.array(FoodCandidateSchema).default([]),
  userCorrections: z.array(z.unknown()).default([]),
  nutritionResult: CalculatedNutritionSummarySchema.optional(),
  uncertaintyNotes: z.array(z.string()).default([]),
  errorMessage: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  mealType: ScanMealTypeSchema.nullable().optional(),
  mealEntryId: UuidSchema.nullable().optional(),
  userEdited: z.boolean().default(false),
  uploadedAt: z.string().nullable().optional(),
  processedAt: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Legacy FoodScanResponseSchema for backward compatibility
export const FoodScanResponseSchema = z.object({
  scanId: UuidSchema,
  status: ScanStatusSchema,
  latencyMs: z.number().int().finite().nonnegative().optional(),
  detectedItems: z.array(DetectedFoodItemSchema).default([]),
  totalEstimatedCalories: z.number().finite().nonnegative().optional(),
  uncertaintyNotes: z.array(z.string()).default([]),
});

export type SupportedImageMimeType = z.infer<typeof SupportedImageMimeTypeSchema>;
export type CreateScanRequest = z.infer<typeof CreateScanRequestSchema>;
export type CreateScanResponse = z.infer<typeof CreateScanResponseSchema>;
export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>;
export type PresignUploadResponse = z.infer<typeof PresignUploadResponseSchema>;
export type AnalyzeScanRequest = z.infer<typeof AnalyzeScanRequestSchema>;
export type ProcessScanResponse = z.infer<typeof ProcessScanResponseSchema>;
export type PortionEstimate = z.infer<typeof PortionEstimateSchema>;
export type FoodMatchOption = z.infer<typeof FoodMatchOptionSchema>;
export type FoodCandidate = z.infer<typeof FoodCandidateSchema>;
export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type CalculatedItemNutrients = z.infer<typeof CalculatedItemNutrientsSchema>;
export type CalculatedNutritionSummary = z.infer<typeof CalculatedNutritionSummarySchema>;
export type CorrectionItem = z.infer<typeof CorrectionItemSchema>;
export type SubmitScanCorrection = z.infer<typeof SubmitScanCorrectionSchema>;
export type ConfirmScanRequest = z.infer<typeof ConfirmScanRequestSchema>;
export type ConfirmScanResponse = z.infer<typeof ConfirmScanResponseSchema>;
export type CancelScanResponse = z.infer<typeof CancelScanResponseSchema>;
export type ScanDetailResponse = z.infer<typeof ScanDetailResponseSchema>;
export type DetectedFoodItem = z.infer<typeof DetectedFoodItemSchema>;
export type FoodScanResponse = z.infer<typeof FoodScanResponseSchema>;
