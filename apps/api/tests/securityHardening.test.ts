import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { createApp } from '../src/app.js';

describe('Security Hardening & Production Reliability (Part 13)', () => {
  describe('Rate Limiting Middleware', () => {
    it('throttles rapid repeated requests exceeding limit with 429', async () => {
      const testApp = express();
      testApp.use(
        createRateLimiter({
          windowMs: 10_000,
          max: 3,
          message: 'Rate limit exceeded.',
        }),
      );
      testApp.get('/test-throttle', (_req, res) => res.json({ ok: true }));

      // Requests 1, 2, 3 should succeed
      const r1 = await request(testApp).get('/test-throttle').set('x-test-rate-limit', 'true');
      expect(r1.status).toBe(200);
      expect(r1.headers['x-ratelimit-remaining']).toBe('2');

      const r2 = await request(testApp).get('/test-throttle').set('x-test-rate-limit', 'true');
      expect(r2.status).toBe(200);
      expect(r2.headers['x-ratelimit-remaining']).toBe('1');

      const r3 = await request(testApp).get('/test-throttle').set('x-test-rate-limit', 'true');
      expect(r3.status).toBe(200);
      expect(r3.headers['x-ratelimit-remaining']).toBe('0');

      // Request 4 should be throttled
      const r4 = await request(testApp).get('/test-throttle').set('x-test-rate-limit', 'true');
      expect(r4.status).toBe(429);
      expect(r4.headers['retry-after']).toBeDefined();
    });
  });

  describe('Security Headers & CORS Policies', () => {
    let app: any;

    beforeAll(() => {
      app = createApp();
    });

    it('emits Helmet security headers on HTTP responses', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('rejects CORS preflight from disallowed origins', async () => {
      const res = await request(app)
        .options('/api/v1/foods/search')
        .set('Origin', 'https://malicious-attacker-site.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(403);
    });
  });
});
