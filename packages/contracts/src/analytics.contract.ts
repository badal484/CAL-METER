import { z } from 'zod';
import { AnalyticsEventName } from '@calmeter/shared';

export const TrackAnalyticsEventSchema = z.object({
  eventName: z.union([z.nativeEnum(AnalyticsEventName), z.string().min(1).max(100)]),
  properties: z.record(z.unknown()).default({}),
  devicePlatform: z.string().max(20).optional().nullable(),
  appVersion: z.string().max(50).optional().nullable(),
  sessionId: z.string().max(100).optional().nullable(),
  timestamp: z.string().datetime().optional(),
});

export type TrackAnalyticsEventInput = z.infer<typeof TrackAnalyticsEventSchema>;

export const BatchAnalyticsEventsSchema = z.object({
  events: z.array(TrackAnalyticsEventSchema).min(1).max(100),
});

export type BatchAnalyticsEventsInput = z.infer<typeof BatchAnalyticsEventsSchema>;

export const AnalyticsIngestionResponseSchema = z.object({
  status: z.literal('ok'),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});

export type AnalyticsIngestionResponse = z.infer<typeof AnalyticsIngestionResponseSchema>;
