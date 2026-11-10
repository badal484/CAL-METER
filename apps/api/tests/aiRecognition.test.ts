import { describe, it, expect } from 'vitest';
import { MockFoodVisionProvider } from '../src/ai/providers/mockVision.provider.js';
import { GeminiVisionProvider } from '../src/ai/providers/geminiVision.provider.js';
import {
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  MalformedModelOutputError,
  FoodRecognitionRequest,
} from '../src/ai/types.js';

describe('AI Vision Recognition Engine & Provider Abstraction', () => {
  const dummyRequest: FoodRecognitionRequest = {
    imageBuffer: Buffer.alloc(200, 0xaa),
    mimeType: 'image/jpeg',
    scanId: 'scan-1111-2222',
    userId: 'user-9999',
  };

  it('recognizes a single food item with portion and confidence metrics', async () => {
    const provider = new MockFoodVisionProvider('single');
    const response = await provider.recognizeFood(dummyRequest);

    expect(response.provider).toBe('mock');
    expect(response.items.length).toBe(1);

    const item = response.items[0]!;
    expect(item.name).toBe('Whole Wheat Roti / Phulka');
    expect(item.alternateNames).toContain('Phulka');
    expect(item.category).toBe('bread');
    expect(item.portion.quantity).toBe(2);
    expect(item.portion.unit).toBe('piece');
    expect(item.portion.estimatedGrams).toBe(70);
    expect(item.confidenceScore).toBeGreaterThan(0.9);
    expect(response.uncertaintyNotes.length).toBeGreaterThan(0);
  });

  it('recognizes multiple food items on a single plate', async () => {
    const provider = new MockFoodVisionProvider('multi');
    const response = await provider.recognizeFood(dummyRequest);

    expect(response.items.length).toBe(2);
    const names = response.items.map(i => i.name);
    expect(names).toContain('Whole Wheat Roti / Phulka');
    expect(names).toContain('Dal Tadka (Home-style)');

    const dal = response.items.find(i => i.name.includes('Dal'))!;
    expect(dal.portion.unit).toBe('katori');
    expect(dal.portion.estimatedGrams).toBe(200);
  });

  it('recognizes a complete Indian thali with 8 distinct components', async () => {
    const provider = new MockFoodVisionProvider('thali');
    const response = await provider.recognizeFood(dummyRequest);

    expect(response.items.length).toBe(8);
    expect(response.sceneContext?.plateType).toBe('STAINLESS_THALI');

    const names = response.items.map(i => i.name);
    expect(names).toContain('Dal Tadka (Home-style)');
    expect(names).toContain('Steamed Basmati Rice');
    expect(names).toContain('Whole Wheat Roti / Phulka');
    expect(names).toContain('Paneer Butter Masala');
    expect(names).toContain('Plain Curd / Dahi');
    expect(names).toContain('Cucumber & Tomato Salad');
    expect(names).toContain('Mixed Pickle');
    expect(names).toContain('Gulab Jamun');

    // Verify gravies are distinguished
    const paneer = response.items.find(i => i.name.includes('Paneer'))!;
    expect(paneer.visualIndicators?.oilSheen).toBe('HEAVY');
    expect(paneer.components).toContain('butter');
  });

  it('handles low confidence visually ambiguous items with explicit uncertainty reason', async () => {
    const provider = new MockFoodVisionProvider('low_confidence');
    const response = await provider.recognizeFood(dummyRequest);

    expect(response.items.length).toBe(1);
    const item = response.items[0]!;
    expect(item.confidenceScore).toBeLessThan(0.5);
    expect(item.uncertaintyReason).toBeDefined();
    expect(item.uncertaintyReason).toContain('partially obscured');
  });

  it('handles empty food recognition results without errors', async () => {
    const provider = new MockFoodVisionProvider('empty');
    const response = await provider.recognizeFood(dummyRequest);

    expect(response.items.length).toBe(0);
    expect(response.uncertaintyNotes).toContain(
      'No food items could be identified with acceptable confidence.',
    );
  });

  it('throws retryable ProviderTimeoutError on AI provider timeouts', async () => {
    const provider = new MockFoodVisionProvider('timeout');
    await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(ProviderTimeoutError);
    await expect(provider.recognizeFood(dummyRequest)).rejects.toSatisfy(
      (err: any) => err.isRetryable === true && err.code === 'PROVIDER_TIMEOUT',
    );
  });

  it('throws retryable ProviderRateLimitError on AI provider HTTP 429 quota exhaustion', async () => {
    const provider = new MockFoodVisionProvider('rate_limit');
    await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(ProviderRateLimitError);
    await expect(provider.recognizeFood(dummyRequest)).rejects.toSatisfy(
      (err: any) => err.isRetryable === true && err.code === 'PROVIDER_RATE_LIMIT',
    );
  });

  it('throws retryable ProviderUnavailableError on AI provider HTTP 503 outage', async () => {
    const provider = new MockFoodVisionProvider('outage');
    await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(ProviderUnavailableError);
    await expect(provider.recognizeFood(dummyRequest)).rejects.toSatisfy(
      (err: any) => err.isRetryable === true && err.code === 'PROVIDER_UNAVAILABLE',
    );
  });

  it('throws non-retryable MalformedModelOutputError on corrupted model output', async () => {
    const provider = new MockFoodVisionProvider('malformed');
    await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(MalformedModelOutputError);
    await expect(provider.recognizeFood(dummyRequest)).rejects.toSatisfy(
      (err: any) => err.isRetryable === false && err.code === 'MALFORMED_MODEL_OUTPUT',
    );
  });

  describe('GeminiVisionProvider Integration & Error Mapping', () => {
    it('throws FoodRecognitionError when GEMINI_API_KEY is missing', async () => {
      const provider = new GeminiVisionProvider({ apiKey: '' });
      await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(
        /GEMINI_API_KEY is not configured/,
      );
    });

    it('maps HTTP 429 from Gemini endpoint to ProviderRateLimitError', async () => {
      // Mock global fetch
      const originalFetch = global.fetch;
      global.fetch = async () =>
        new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), {
          status: 429,
          statusText: 'Too Many Requests',
        });

      try {
        const provider = new GeminiVisionProvider({ apiKey: 'mock-key' });
        await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(ProviderRateLimitError);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('maps HTTP 503 from Gemini endpoint to ProviderUnavailableError', async () => {
      const originalFetch = global.fetch;
      global.fetch = async () =>
        new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), {
          status: 503,
          statusText: 'Service Unavailable',
        });

      try {
        const provider = new GeminiVisionProvider({ apiKey: 'mock-key' });
        await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(
          ProviderUnavailableError,
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('maps malformed non-JSON candidate text to MalformedModelOutputError', async () => {
      const originalFetch = global.fetch;
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Here is some invalid non-json response from the model...' }],
                },
              },
            ],
          }),
          { status: 200 },
        );

      try {
        const provider = new GeminiVisionProvider({ apiKey: 'mock-key' });
        await expect(provider.recognizeFood(dummyRequest)).rejects.toThrow(
          MalformedModelOutputError,
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
