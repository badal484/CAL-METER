import { z } from 'zod';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const LogWeightSchema = z.object({
  weightKg: z
    .number()
    .finite({ message: 'Weight must be a finite number.' })
    .min(30, { message: 'Weight must be at least 30 kg.' })
    .max(350, { message: 'Weight cannot exceed 350 kg.' }),
  loggedAt: z.string().datetime().optional(),
  notes: z.string().max(255).optional(),
});

export const WeightLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  weightKg: z.number().finite(),
  loggedAt: z.string().datetime(),
  notes: z.string().nullable().optional(),
});

export const LogWaterSchema = z.object({
  date: IsoDateStringSchema,
  amountMl: z
    .number()
    .int()
    .finite()
    .positive({ message: 'Water intake increment must be a positive integer in ml.' })
    .max(5000, { message: 'Single water entry cannot exceed 5,000 ml.' }),
});

export const WaterLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  date: IsoDateStringSchema,
  amountMl: z.number().int().finite().nonnegative(),
  loggedAt: z.string().datetime(),
});

export type LogWeightDto = z.infer<typeof LogWeightSchema>;
export type WeightLogDto = z.infer<typeof WeightLogSchema>;
export type LogWaterDto = z.infer<typeof LogWaterSchema>;
export type WaterLogDto = z.infer<typeof WaterLogSchema>;
