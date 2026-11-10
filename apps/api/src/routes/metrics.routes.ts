import { Router, type Request, type Response } from 'express';
import { globalOperationalMetrics } from '../services/operationalMetrics.service.js';

export function createMetricsRoutes(): Router {
  const router = Router();

  // GET /api/v1/metrics
  router.get('/', (req: Request, res: Response) => {
    const isPrometheus =
      req.query.format === 'prometheus' || req.headers.accept?.includes('text/plain');

    if (isPrometheus) {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return res.status(200).send(globalOperationalMetrics.toPrometheusFormat('calmeter_api'));
    }

    const metrics = globalOperationalMetrics.getMetrics('calmeter-api');
    return res.status(200).json(metrics);
  });

  return router;
}
