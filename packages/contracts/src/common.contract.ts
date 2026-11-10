import { z } from 'zod';

export const UuidSchema = z.string().uuid({ message: 'Must be a valid UUID v4 format.' });

export const IsoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be formatted as YYYY-MM-DD.' });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
});

export const ApiErrorDetailSchema = z.object({
  field: z.string().optional(),
  issue: z.string(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ApiErrorDetailSchema).optional(),
  }),
});

export function createApiSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: PaginationMetaSchema.optional(),
  });
}

export type Uuid = z.infer<typeof UuidSchema>;
export type IsoDateString = z.infer<typeof IsoDateStringSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
