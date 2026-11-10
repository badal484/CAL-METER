import { describe, it, expect } from 'vitest';
import { sanitizeAnalyticsProperties, isSensitiveKey } from '../src/utils/analyticsSanitizer.js';

describe('Analytics Privacy & Property Sanitizer (Part 13)', () => {
  describe('isSensitiveKey', () => {
    it('detects credentials and authentication fields', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('userPassword')).toBe(true);
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('bearerToken')).toBe(true);
      expect(isSensitiveKey('authHeader')).toBe(true);
      expect(isSensitiveKey('secret')).toBe(true);
    });

    it('detects personal notes and private coach communications', () => {
      expect(isSensitiveKey('coachPrompt')).toBe(true);
      expect(isSensitiveKey('coachResponse')).toBe(true);
      expect(isSensitiveKey('rawText')).toBe(true);
      expect(isSensitiveKey('notes')).toBe(true);
      expect(isSensitiveKey('messageText')).toBe(true);
      expect(isSensitiveKey('email')).toBe(true);
      expect(isSensitiveKey('phoneNumber')).toBe(true);
    });

    it('permits non-sensitive analytics dimensions', () => {
      expect(isSensitiveKey('category')).toBe(false);
      expect(isSensitiveKey('screenName')).toBe(false);
      expect(isSensitiveKey('mealType')).toBe(false);
      expect(isSensitiveKey('calories')).toBe(false);
      expect(isSensitiveKey('proteinGrams')).toBe(false);
      expect(isSensitiveKey('durationSeconds')).toBe(false);
    });
  });

  describe('sanitizeAnalyticsProperties', () => {
    it('redacts sensitive keys while preserving safe operational metrics', () => {
      const raw = {
        screen: 'FoodDiary',
        mealType: 'LUNCH',
        calories: 650,
        userPassword: 'plaintext-secret',
        authToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae75wmnrJ19720z08ulgLhM68ffCCnDX5qblBVVic',
        notes: 'Had a private medical conversation',
        coachResponse: 'Private advice text',
      };

      const sanitized = sanitizeAnalyticsProperties(raw);

      expect(sanitized.screen).toBe('FoodDiary');
      expect(sanitized.mealType).toBe('LUNCH');
      expect(sanitized.calories).toBe(650);
      expect(sanitized.userPassword).toBe('[REDACTED]');
      expect(sanitized.authToken).toBe('[REDACTED]');
      expect(sanitized.notes).toBe('[REDACTED]');
      expect(sanitized.coachResponse).toBe('[REDACTED]');
    });

    it('detects and redacts emails and raw JWT strings in non-sensitive keys', () => {
      const payload = {
        debugInfo: 'Sent to user@domain.com for inspection',
        rawHeader:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae75wmnrJ19720z08ulgLhM68ffCCnDX5qblBVVic',
      };

      const sanitized = sanitizeAnalyticsProperties(payload);

      expect(sanitized.debugInfo).toBe('[REDACTED_EMAIL]');
      expect(sanitized.rawHeader).toBe('[REDACTED_TOKEN]');
    });

    it('recursively sanitizes nested objects and arrays', () => {
      const nested = {
        metadata: {
          step: 2,
          credentials: {
            apiKey: 'xyz-999',
            token: 'secret-tok',
          },
        },
        items: [
          { name: 'Apple', calories: 95 },
          { name: 'Private item', password: 'nested-pass' },
        ],
      };

      const sanitized = sanitizeAnalyticsProperties(nested) as any;

      expect(sanitized.metadata.step).toBe(2);
      expect(sanitized.metadata.credentials.apiKey).toBe('[REDACTED]');
      expect(sanitized.metadata.credentials.token).toBe('[REDACTED]');
      expect(sanitized.items[0].name).toBe('Apple');
      expect(sanitized.items[1].password).toBe('[REDACTED]');
    });

    it('handles null, undefined and empty objects safely', () => {
      expect(sanitizeAnalyticsProperties(null)).toEqual({});
      expect(sanitizeAnalyticsProperties(undefined)).toEqual({});
      expect(sanitizeAnalyticsProperties({})).toEqual({});
    });
  });
});
