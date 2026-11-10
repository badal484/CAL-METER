import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createOptionalAuthMiddleware } from '../middleware/auth.js';
import { type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { TrackAnalyticsEventSchema, BatchAnalyticsEventsSchema } from '@calmeter/contracts';
import { AnalyticsService } from '../services/analytics.service.js';
import { validateBody } from '../middleware/validate.js';

export interface AnalyticsRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
}

export function createAnalyticsRoutes(options?: AnalyticsRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const authMiddleware = createOptionalAuthMiddleware(options?.verifier);
  const analyticsService = new AnalyticsService(prisma);

  router.use(authMiddleware);

  async function getOptionalUserId(req: Request): Promise<string | null> {
    if (!req.user) return null;
    try {
      return await resolveInternalUserId(prisma, req.user);
    } catch {
      return null;
    }
  }

  // POST /api/v1/analytics/track
  router.post(
    '/track',
    validateBody(TrackAnalyticsEventSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getOptionalUserId(req);
        await analyticsService.trackEvent(userId, req.body);
        return res.status(200).json({
          status: 'ok',
          accepted: 1,
          rejected: 0,
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  // POST /api/v1/analytics/batch
  router.post(
    '/batch',
    validateBody(BatchAnalyticsEventsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getOptionalUserId(req);
        const result = await analyticsService.trackBatch(userId, req.body.events);
        return res.status(200).json({
          status: 'ok',
          accepted: result.accepted,
          rejected: result.rejected,
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  return router;
}
