import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetConfigForTesting, validateEnv } from '../src/config/env.js';

describe('API Foundation Middleware & Server Behaviors', () => {
  it('app can be constructed without binding to a network port', () => {
    const app = createApp();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  describe('Request ID Handling', () => {
    it('generates a UUID request ID when incoming x-request-id is omitted', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      const reqId = res.headers['x-request-id'];
      expect(reqId).toBeDefined();
      expect(typeof reqId).toBe('string');
      // UUID format assertion
      expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('preserves a valid, safe incoming x-request-id', async () => {
      const app = createApp();
      const customId = 'client-req-9988-safe_id';
      const res = await request(app).get('/health').set('x-request-id', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('replaces an invalid or malformed incoming x-request-id with a safe UUID', async () => {
      const app = createApp();
      const maliciousId = '<script>alert(1)</script>';
      const res = await request(app).get('/health').set('x-request-id', maliciousId);

      const reqId = res.headers['x-request-id'];
      expect(reqId).not.toBe(maliciousId);
      expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Centralized 404 & Error Handling', () => {
    it('returns standard RESOURCE_NOT_FOUND error envelope for unknown routes', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/unknown-endpoint');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Route not found: GET /api/v1/unknown-endpoint',
        },
      });
    });

    it('handles malformed JSON body with a 400 VALIDATION_ERROR envelope', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/v1/auth/test')
        .set('Content-Type', 'application/json')
        .send('{"invalidJson": ');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('redacts internal exception details and stack traces in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        const prodConfig = validateEnv({
          ...process.env,
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_prod',
          REDIS_URL: 'redis://localhost:6379',
          CORS_ORIGIN: 'https://calmeter.app',
        });
        resetConfigForTesting(prodConfig);

        const app = createApp({
          configureRoutes: testApp => {
            testApp.get('/test-error', () => {
              throw new Error('Sensitive database credentials in memory: secret123');
            });
          },
        });

        const res = await request(app).get('/test-error');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected internal server error occurred.',
          },
        });
        expect(JSON.stringify(res.body)).not.toContain('secret123');
        expect(res.body.stack).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
        resetConfigForTesting();
      }
    });
  });

  describe('Security & CORS Configuration', () => {
    it('permits requests from allowlisted CORS origin and sets Access-Control-Allow-Origin', async () => {
      const app = createApp();
      const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('rejects requests from disallowed CORS origins', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-site.example.com');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_RESOURCE');
    });

    it('enforces request body size limits returning 413 for oversized payloads', async () => {
      const originalEnv = process.env.MAX_REQUEST_SIZE;
      try {
        const smallLimitConfig = validateEnv({
          ...process.env,
          MAX_REQUEST_SIZE: '100b',
          DATABASE_URL: 'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
          REDIS_URL: 'redis://localhost:6379',
        });
        resetConfigForTesting(smallLimitConfig);

        const app = createApp();
        const largeString = 'x'.repeat(500);

        const res = await request(app)
          .post('/api/v1/auth/test')
          .set('Content-Type', 'application/json')
          .send({ payload: largeString });

        expect(res.status).toBe(413);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      } finally {
        process.env.MAX_REQUEST_SIZE = originalEnv;
        resetConfigForTesting();
      }
    });
  });
});
