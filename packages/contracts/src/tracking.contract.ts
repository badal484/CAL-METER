import { z } from 'zod';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';
import {
  ExerciseCategory,
  ExerciseIntensity,
  CalorieEstimateSource,
  WaterUnit,
} from '@calmeter/shared';

// -------------------------------------------------------------
// ENUM SCHEMAS
// -------------------------------------------------------------

export const ExerciseCategorySchema = z.nativeEnum(ExerciseCategory);
export const ExerciseIntensitySchema = z.nativeEnum(ExerciseIntensity);
export const CalorieEstimateSourceSchema = z.nativeEnum(CalorieEstimateSource);
export const WaterUnitSchema = z.nativeEnum(WaterUnit);

// -------------------------------------------------------------
// WEIGHT SCHEMAS
// -------------------------------------------------------------

export const LogWeightSchema = z.object({
  weightKg: z
    .number()
    .finite({ message: 'Weight must be a finite number.' })
    .min(30, { message: 'Weight must be at least 30 kg.' })
    .max(350, { message: 'Weight cannot exceed 350 kg.' }),
  loggedAt: z.string().datetime().optional(),
  notes: z.string().max(255).optional(),
  source: z.string().max(50).default('MANUAL'),
});

export const UpdateWeightLogSchema = z.object({
  weightKg: z
    .number()
    .finite({ message: 'Weight must be a finite number.' })
    .min(30, { message: 'Weight must be at least 30 kg.' })
    .max(350, { message: 'Weight cannot exceed 350 kg.' })
    .optional(),
  loggedAt: z.string().datetime().optional(),
  notes: z.string().max(255).nullable().optional(),
});

export const WeightLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  weightKg: z.number().finite(),
  loggedAt: z.string().datetime(),
  notes: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const WeightProgressSummarySchema = z.object({
  currentWeightKg: z.number().finite(),
  startWeightKg: z.number().finite().nullable(),
  previousWeightKg: z.number().finite().nullable(),
  targetWeightKg: z.number().finite().nullable(),
  netChangeKg: z.number().finite().nullable(),
  progressPercentage: z.number().finite().nullable(),
  minWeightKg: z.number().finite().nullable(),
  maxWeightKg: z.number().finite().nullable(),
  trend: z.enum(['LOSING', 'GAINING', 'MAINTAINING', 'INSUFFICIENT_DATA']),
  history: z.array(WeightLogSchema),
});

// -------------------------------------------------------------
// WATER SCHEMAS
// -------------------------------------------------------------

export const LogWaterSchema = z.object({
  amountMl: z
    .number()
    .int()
    .finite()
    .positive({ message: 'Water intake increment must be a positive integer in ml.' })
    .max(5000, { message: 'Single water entry cannot exceed 5,000 ml.' }),
  date: IsoDateStringSchema.optional(),
  loggedAt: z.string().datetime().optional(),
  source: z.string().max(50).default('MANUAL'),
});

export const UpdateWaterLogSchema = z.object({
  amountMl: z
    .number()
    .int()
    .finite()
    .positive({ message: 'Water intake increment must be a positive integer in ml.' })
    .max(5000, { message: 'Single water entry cannot exceed 5,000 ml.' })
    .optional(),
  date: IsoDateStringSchema.optional(),
});

export const WaterLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  date: IsoDateStringSchema,
  amountMl: z.number().int().finite().nonnegative(),
  loggedAt: z.string().datetime(),
  source: z.string().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const DailyWaterSummarySchema = z.object({
  date: IsoDateStringSchema,
  totalMl: z.number().int().nonnegative(),
  targetMl: z.number().int().positive(),
  percentage: z.number().nonnegative(),
  entries: z.array(WaterLogSchema),
  disclaimer: z.string(),
});

// -------------------------------------------------------------
// EXERCISE SCHEMAS
// -------------------------------------------------------------

export const LogExerciseSchema = z.object({
  name: z.string().trim().min(1, { message: 'Activity name is required.' }).max(100),
  category: ExerciseCategorySchema,
  durationMinutes: z
    .number()
    .int()
    .positive({ message: 'Duration must be greater than 0 minutes.' })
    .max(1440, { message: 'Duration cannot exceed 1,440 minutes (24 hours).' }),
  performedAt: z.string().datetime().optional(),
  date: IsoDateStringSchema.optional(),
  distanceKm: z.number().finite().positive().max(500).optional(),
  intensity: ExerciseIntensitySchema.default(ExerciseIntensity.MODERATE),
  caloriesBurned: z.number().finite().nonnegative().max(10000).optional(),
  estimateCalories: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export const UpdateExerciseLogSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: ExerciseCategorySchema.optional(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  performedAt: z.string().datetime().optional(),
  date: IsoDateStringSchema.optional(),
  distanceKm: z.number().finite().positive().max(500).nullable().optional(),
  intensity: ExerciseIntensitySchema.optional(),
  caloriesBurned: z.number().finite().nonnegative().max(10000).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const ExerciseLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: z.string(),
  category: ExerciseCategorySchema,
  durationMinutes: z.number().int(),
  performedAt: z.string().datetime(),
  date: IsoDateStringSchema,
  distanceKm: z.number().nullable().optional(),
  intensity: ExerciseIntensitySchema,
  caloriesBurned: z.number().nullable().optional(),
  calorieSource: CalorieEstimateSourceSchema.nullable().optional(),
  metValue: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// -------------------------------------------------------------
// PROGRESS REPORT SCHEMAS
// -------------------------------------------------------------

export const ProgressQuerySchema = z.object({
  startDate: IsoDateStringSchema.optional(),
  endDate: IsoDateStringSchema.optional(),
  days: z.coerce.number().int().positive().max(365).optional(),
});

export const ProgressReportSchema = z.object({
  startDate: IsoDateStringSchema,
  endDate: IsoDateStringSchema,
  weight: WeightProgressSummarySchema,
  water: z.object({
    averageDailyMl: z.number(),
    daysTracked: z.number(),
    targetMl: z.number(),
    adherenceRate: z.number(),
  }),
  exercise: z.object({
    totalSessions: z.number(),
    totalDurationMinutes: z.number(),
    totalCaloriesBurned: z.number(),
    sessionsByCategory: z.record(z.string(), z.number()),
  }),
  disclaimers: z.array(z.string()),
});

// -------------------------------------------------------------
// TYPE EXPORTS
// -------------------------------------------------------------

export type LogWeightDto = z.input<typeof LogWeightSchema>;
export type UpdateWeightLogDto = z.infer<typeof UpdateWeightLogSchema>;
export type WeightLogDto = z.infer<typeof WeightLogSchema>;
export type WeightProgressSummaryDto = z.infer<typeof WeightProgressSummarySchema>;

export type LogWaterDto = z.input<typeof LogWaterSchema>;
export type UpdateWaterLogDto = z.infer<typeof UpdateWaterLogSchema>;
export type WaterLogDto = z.infer<typeof WaterLogSchema>;
export type DailyWaterSummaryDto = z.infer<typeof DailyWaterSummarySchema>;

export type LogExerciseDto = z.input<typeof LogExerciseSchema>;
export type UpdateExerciseLogDto = z.infer<typeof UpdateExerciseLogSchema>;
export type ExerciseLogDto = z.infer<typeof ExerciseLogSchema>;

export type ProgressQueryDto = z.infer<typeof ProgressQuerySchema>;
export type ProgressReportDto = z.infer<typeof ProgressReportSchema>;
