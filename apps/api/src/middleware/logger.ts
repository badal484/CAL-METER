import type { Request, Response, NextFunction } from 'express';
import { globalOperationalMetrics } from '../services/operationalMetrics.service.js';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    globalOperationalMetrics.recordHttpRequest(res.statusCode, durationMs);
    const reqLogger = req.log;

    if (reqLogger) {
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      };

      if (res.statusCode >= 500) {
        reqLogger.error(logData, 'HTTP Request Error');
      } else if (res.statusCode >= 400) {
        reqLogger.warn(logData, 'HTTP Request Warning');
      } else {
        reqLogger.info(logData, 'HTTP Request Completed');
      }
    }
  });

  next();
}
