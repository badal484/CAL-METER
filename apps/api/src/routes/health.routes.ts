import { Router, type Request, type Response } from 'express';
import { checkDatabaseHealth } from '../lib/prisma.js';
import { checkRedisHealth } from '../lib/redis.js';
import { globalOperationalMetrics } from '../services/operationalMetrics.service.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const [dbHealthy, redisHealthy] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

  if (dbHealthy && redisHealthy) {
    res.status(200).json({
      success: true,
      data: {
        status: 'ready',
        checks: {
          database: 'healthy',
          redis: 'healthy',
        },
      },
    });
    return;
  }

  const details = [];
  if (!dbHealthy) {
    details.push({ service: 'database', issue: 'PostgreSQL connection check failed' });
  }
  if (!redisHealthy) {
    details.push({ service: 'redis', issue: 'Redis ping check failed' });
  }

  res.status(503).json({
    success: false,
    error: {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'One or more required infrastructure dependencies are unavailable.',
      details,
    },
  });
});

healthRouter.get('/metrics', (req: Request, res: Response) => {
  const isPrometheus =
    req.query.format === 'prometheus' || req.headers.accept?.includes('text/plain');

  if (isPrometheus) {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.status(200).send(globalOperationalMetrics.toPrometheusFormat('calmeter_api'));
  }

  const metrics = globalOperationalMetrics.getMetrics('calmeter-api');
  return res.status(200).json(metrics);
});

healthRouter.get('/health/metrics', (_req: Request, res: Response) => {
  const metrics = globalOperationalMetrics.getMetrics('calmeter-api');
  return res.status(200).json(metrics);
});
