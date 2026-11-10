import { z } from 'zod';
import { ServingProvenance } from '@calmeter/shared';
import { UuidSchema } from './common.contract.js';

export const ServingProvenanceSchema = z.nativeEnum(ServingProvenance);

export const FoodServingConversionSchema = z.object({
  id: UuidSchema.optional(),
  foodItemId: UuidSchema.optional(),
  unit: z.string().min(1).max(50),
  gramWeight: z
    .number()
    .finite({ message: 'Serving gram weight must be a finite number.' })
    .positive({ message: 'Serving gram weight must be a positive number.' }),
  volumeMl: z.number().finite().positive().optional(),
  provenance: ServingProvenanceSchema.default(ServingProvenance.USER_CONFIGURED),
  notes: z.string().max(255).optional(),
  isDefault: z.boolean().default(false),
});

export const ServingConversionRequestSchema = z.object({
  foodItemId: UuidSchema.optional(),
  unit: z.string().min(1),
  quantity: z
    .number()
    .finite({ message: 'Serving quantity must be a finite number.' })
    .positive({ message: 'Serving quantity must be a positive number.' }),
});

export const ServingConversionResponseSchema = z.object({
  success: z.boolean(),
  gramWeight: z.number().finite().optional(),
  unit: z.string().optional(),
  quantity: z.number().finite().optional(),
  provenance: ServingProvenanceSchema.optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type FoodServingConversionDto = z.infer<typeof FoodServingConversionSchema>;
export type ServingConversionRequest = z.infer<typeof ServingConversionRequestSchema>;
export type ServingConversionResponse = z.infer<typeof ServingConversionResponseSchema>;
