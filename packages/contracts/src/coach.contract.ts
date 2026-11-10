import { z } from 'zod';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';
import { CoachRole, InsightType, InsightCategory, MealType } from '@calmeter/shared';

// -------------------------------------------------------------
// ENUM SCHEMAS
// -------------------------------------------------------------

export const CoachRoleSchema = z.nativeEnum(CoachRole);
export const InsightTypeSchema = z.nativeEnum(InsightType);
export const InsightCategorySchema = z.nativeEnum(InsightCategory);

// -------------------------------------------------------------
// COACH MESSAGE SCHEMAS
// -------------------------------------------------------------

export const SendCoachMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { message: 'Message content cannot be empty.' })
    .max(2000, { message: 'Message content cannot exceed 2,000 characters.' }),
});

export const CoachMessageSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  role: CoachRoleSchema,
  content: z.string(),
  metadata: z.record(z.unknown()).nullish(),
  createdAt: z.string().datetime(),
});

export const CoachConversationHistorySchema = z.object({
  messages: z.array(CoachMessageSchema),
  totalCount: z.number().int().min(0),
});

// -------------------------------------------------------------
// INSIGHT SCHEMAS
// -------------------------------------------------------------

export const PersonalizedInsightSchema = z.object({
  id: UuidSchema.optional(),
  type: InsightTypeSchema,
  category: InsightCategorySchema,
  title: z.string().min(1).max(150),
  message: z.string().min(1),
  actionableTip: z.string().max(300).nullish(),
  periodAnalyzed: z.string().max(50),
  metricData: z
    .object({
      current: z.number(),
      target: z.number(),
      unit: z.string(),
      percentage: z.number().optional(),
      delta: z.number().optional(),
    })
    .passthrough()
    .nullish(),
  generatedAt: z.string().datetime().optional(),
});

export const InsightsResponseSchema = z.object({
  date: IsoDateStringSchema,
  insights: z.array(PersonalizedInsightSchema),
  disclaimer: z.string(),
});

// -------------------------------------------------------------
// MEAL RECOMMENDATION SCHEMAS
// -------------------------------------------------------------

export const MealRecommendationItemSchema = z.object({
  foodId: UuidSchema.optional(),
  foodName: z.string().min(1),
  portionAmount: z.number().positive(),
  servingUnit: z.string().min(1),
  gramWeight: z.number().positive(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  isVerified: z.boolean().default(true),
});

export const MealRecommendationSchema = z.object({
  id: z.string(),
  mealType: z.nativeEnum(MealType),
  title: z.string().min(1),
  description: z.string().min(1),
  cuisine: z.string(),
  totalCalories: z.number().min(0),
  totalProtein: z.number().min(0),
  totalCarbs: z.number().min(0),
  totalFat: z.number().min(0),
  items: z.array(MealRecommendationItemSchema),
  fitsRemainingBudget: z.boolean(),
  dietaryTags: z.array(z.string()),
});

export const MealRecommendationsResponseSchema = z.object({
  date: IsoDateStringSchema,
  remainingCalories: z.number(),
  remainingProtein: z.number(),
  remainingCarbs: z.number(),
  remainingFat: z.number(),
  recommendations: z.array(MealRecommendationSchema),
  disclaimer: z.string(),
});

export const GetMealRecommendationsQuerySchema = z.object({
  mealType: z.nativeEnum(MealType).optional(),
  date: IsoDateStringSchema.optional(),
});

export const CoachMessageResponseSchema = z.object({
  reply: z.string().min(1),
  messageId: UuidSchema,
  suggestedPrompts: z.array(z.string()).optional(),
  disclaimers: z.array(z.string()),
  relevantInsights: z.array(PersonalizedInsightSchema).optional(),
  recommendedMeals: z.array(MealRecommendationSchema).optional(),
});

// -------------------------------------------------------------
// TYPE EXPORTS
// -------------------------------------------------------------

export type SendCoachMessageDto = z.input<typeof SendCoachMessageSchema>;
export type CoachMessageDto = z.infer<typeof CoachMessageSchema>;
export type CoachConversationHistoryDto = z.infer<typeof CoachConversationHistorySchema>;
export type CoachMessageResponseDto = z.infer<typeof CoachMessageResponseSchema>;

export type PersonalizedInsightDto = z.infer<typeof PersonalizedInsightSchema>;
export type InsightsResponseDto = z.infer<typeof InsightsResponseSchema>;

export type MealRecommendationItemDto = z.infer<typeof MealRecommendationItemSchema>;
export type MealRecommendationDto = z.infer<typeof MealRecommendationSchema>;
export type MealRecommendationsResponseDto = z.infer<typeof MealRecommendationsResponseSchema>;
export type GetMealRecommendationsQueryDto = z.infer<typeof GetMealRecommendationsQuerySchema>;
