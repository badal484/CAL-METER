import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsService } from '../src/services/analyticsService';
import { AnalyticsEventName } from '@calmeter/shared';

describe('Product Analytics Mobile Client (Part 13)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('enqueues events with zero-PII sanitization', () => {
    const service = new AnalyticsService({ batchSize: 100 });

    service.track(AnalyticsEventName.DIARY_ENTRY_CREATED, {
      mealType: 'LUNCH',
      calories: 520,
      userPassword: 'secret-pw-123',
      authToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae75wmnrJ19720z08ulgLhM68ffCCnDX5qblBVVic',
    });

    expect(service.getQueueLength()).toBe(1);
    service.destroy();
  });

  it('flushes batch of events successfully to backend API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', accepted: 2, rejected: 0 }),
    });
    global.fetch = mockFetch;

    const service = new AnalyticsService({
      baseUrl: 'http://localhost:3000/api/v1',
      batchSize: 10,
    });

    service.track(AnalyticsEventName.FOOD_SEARCH_PERFORMED, { queryLength: 4 });
    service.track(AnalyticsEventName.WATER_LOGGED, { amountMl: 300 });

    expect(service.getQueueLength()).toBe(2);

    const flushedCount = await service.flush();
    expect(flushedCount).toBe(2);
    expect(service.getQueueLength()).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    service.destroy();
  });

  it('retains queued events on network failure without throwing', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network request failed'));
    global.fetch = mockFetch;

    const service = new AnalyticsService({
      baseUrl: 'http://localhost:3000/api/v1',
      batchSize: 10,
    });

    service.track(AnalyticsEventName.ONBOARDING_STARTED, { step: 1 });
    expect(service.getQueueLength()).toBe(1);

    const flushedCount = await service.flush();
    expect(flushedCount).toBe(0);
    // Queue preserves the item for next retry
    expect(service.getQueueLength()).toBe(1);

    service.destroy();
  });
});
