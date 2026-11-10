import type { PrismaClient } from '@prisma/client';
import { sanitizeAnalyticsProperties } from '@calmeter/shared';
import type { TrackAnalyticsEventInput } from '@calmeter/contracts';

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Tracks a single analytics event with strict PII scrubbing.
   */
  async trackEvent(userId: string | null | undefined, event: TrackAnalyticsEventInput) {
    const cleanProps = sanitizeAnalyticsProperties(event.properties);
    const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();

    return this.prisma.analyticsEvent.create({
      data: {
        userId: userId ?? null,
        eventName: event.eventName,
        properties: cleanProps as any,
        devicePlatform: event.devicePlatform ?? null,
        appVersion: event.appVersion ?? null,
        sessionId: event.sessionId ?? null,
        timestamp: eventTime,
      },
    });
  }

  /**
   * Ingests a batch of events (e.g. flushed from mobile client).
   */
  async trackBatch(userId: string | null | undefined, events: TrackAnalyticsEventInput[]) {
    if (!events.length) {
      return { accepted: 0, rejected: 0 };
    }

    const records = events.map(event => {
      const cleanProps = sanitizeAnalyticsProperties(event.properties);
      const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();

      return {
        userId: userId ?? null,
        eventName: event.eventName,
        properties: cleanProps as any,
        devicePlatform: event.devicePlatform ?? null,
        appVersion: event.appVersion ?? null,
        sessionId: event.sessionId ?? null,
        timestamp: eventTime,
      };
    });

    const result = await this.prisma.analyticsEvent.createMany({
      data: records,
    });

    return {
      accepted: result.count,
      rejected: 0,
    };
  }

  /**
   * Retrieves recent events for debugging / admin verification.
   */
  async getRecentEvents(userId?: string, limit: number = 50) {
    return this.prisma.analyticsEvent.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
