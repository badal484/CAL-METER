import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { TrackingService } from '../services/tracking.service.js';
import { z } from 'zod';

export interface TrackingRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  trackingService?: TrackingService;
}

const LogWeightBodySchema = z.object({
  weightKg: z
    .number()
    .finite()
    .min(30, { message: 'Weight must be at least 30 kg.' })
    .max(350, { message: 'Weight cannot exceed 350 kg.' }),
  notes: z.string().max(255).optional(),
});

export function createTrackingRouter(options?: TrackingRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const trackingService = options?.trackingService || new TrackingService(prisma);

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * POST /tracking/weight
   * Logs a new body weight reading and updates user profile.
   */
  router.post(
    '/weight',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = LogWeightBodySchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const result = await trackingService.logWeight(
          userId,
          parsed.data.weightKg,
          parsed.data.notes,
        );
        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /tracking/weight
   * Retrieves user weight measurement history.
   */
  router.get('/weight', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const history = await trackingService.getWeightHistory(userId, limit);
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
