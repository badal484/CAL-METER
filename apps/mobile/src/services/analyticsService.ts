import { type AnalyticsEventName, sanitizeAnalyticsProperties } from '@calmeter/shared';
import type { TrackAnalyticsEventInput } from '@calmeter/contracts';

export interface AnalyticsServiceConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
}

export class AnalyticsService {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;
  private queue: TrackAnalyticsEventInput[] = [];
  private batchSize: number;
  private maxQueueSize: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(config?: AnalyticsServiceConfig) {
    this.baseUrl = config?.baseUrl || 'http://localhost:3000/api/v1';
    this.getAuthToken = config?.getAuthToken;
    this.batchSize = config?.batchSize || 10;
    this.maxQueueSize = config?.maxQueueSize || 100;

    const interval = config?.flushIntervalMs || 15_000;
    if (typeof setInterval !== 'undefined') {
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, interval);
      if (this.flushTimer.unref) {
        this.flushTimer.unref();
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Enqueues an event with zero-PII sanitization.
   */
  track(
    eventName: AnalyticsEventName | string,
    properties: Record<string, unknown> = {},
    metadata?: {
      devicePlatform?: string;
      appVersion?: string;
      sessionId?: string;
    },
  ): void {
    const cleanProps = sanitizeAnalyticsProperties(properties);

    const eventInput: TrackAnalyticsEventInput = {
      eventName,
      properties: cleanProps,
      devicePlatform: metadata?.devicePlatform,
      appVersion: metadata?.appVersion,
      sessionId: metadata?.sessionId,
      timestamp: new Date().toISOString(),
    };

    if (this.queue.length >= this.maxQueueSize) {
      // Discard oldest event if queue exceeds capacity
      this.queue.shift();
    }

    this.queue.push(eventInput);

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  /**
   * Flushes currently queued events to the backend in a single non-blocking HTTP request.
   */
  async flush(): Promise<number> {
    if (this.isFlushing || this.queue.length === 0) {
      return 0;
    }

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.getAuthToken) {
        const token = await this.getAuthToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${this.baseUrl}/analytics/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events: batch }),
      });

      if (!res.ok) {
        // Re-queue on failure if space permits
        this.queue.unshift(...batch.slice(0, Math.max(0, this.maxQueueSize - this.queue.length)));
        return 0;
      }

      return batch.length;
    } catch {
      // Offline / network failure: re-queue failed batch without blocking UI
      this.queue.unshift(...batch.slice(0, Math.max(0, this.maxQueueSize - this.queue.length)));
      return 0;
    } finally {
      this.isFlushing = false;
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue = [];
  }
}

export const defaultAnalyticsService = new AnalyticsService();
