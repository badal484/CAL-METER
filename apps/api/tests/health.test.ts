import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as prismaLib from '../src/lib/prisma.js';
import * as redisLib from '../src/lib/redis.js';

describe('Health and Readiness Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health returns 200 and healthy process status without exposing secrets', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(typeof res.body.data.timestamp).toBe('string');

    // Ensure no connection strings or internal credentials are leaked
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('postgresql:');
    expect(bodyStr).not.toContain('redis:');
    expect(bodyStr).not.toContain('password');
  });

  it('GET /ready returns 200 when database and redis dependencies are healthy', async () => {
    vi.spyOn(prismaLib, 'checkDatabaseHealth').mockResolvedValue(true);
    vi.spyOn(redisLib, 'checkRedisHealth').mockResolvedValue(true);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      status: 'ready',
      checks: {
        database: 'healthy',
        redis: 'healthy',
      },
    });
  });

  it('GET /ready returns 503 when database dependency is unavailable', async () => {
    vi.spyOn(prismaLib, 'checkDatabaseHealth').mockResolvedValue(false);
    vi.spyOn(redisLib, 'checkRedisHealth').mockResolvedValue(true);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ service: 'database' })]),
    );

    // Verify credentials are never leaked in error response
    expect(JSON.stringify(res.body)).not.toContain('postgresql:');
  });

  it('GET /ready returns 503 when redis dependency is unavailable', async () => {
    vi.spyOn(prismaLib, 'checkDatabaseHealth').mockResolvedValue(true);
    vi.spyOn(redisLib, 'checkRedisHealth').mockResolvedValue(false);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ service: 'redis' })]),
    );
  });
});
