import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { SyncSubscriptionRequestSchema, FeatureCheckQuerySchema } from '@calmeter/contracts';

export interface SubscriptionRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  subscriptionService?: SubscriptionService;
}

export function createSubscriptionRouter(options?: SubscriptionRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const subscriptionService = options?.subscriptionService || new SubscriptionService({ prisma });

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * GET /subscriptions/status
   * Authoritative subscription and entitlement status from trusted backend state.
   */
  router.get('/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const result = await subscriptionService.getSubscriptionStatus(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /subscriptions/sync
   * Client-initiated entitlement sync (e.g. after in-app purchase or purchase restoration).
   */
  router.post('/sync', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const parsed = SyncSubscriptionRequestSchema.safeParse(req.body);
      const appUserId = parsed.success ? parsed.data.appUserId : undefined;

      const result = await subscriptionService.syncSubscription(userId, appUserId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /subscriptions/check-access
   * Pre-flight checks whether user has access to a specific protected feature or timeframe.
   */
  router.get(
    '/check-access',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsedQuery = FeatureCheckQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          throw parsedQuery.error;
        }

        const result = await subscriptionService.checkFeatureAccess(
          userId,
          parsedQuery.data.feature,
          parsedQuery.data.historyDays ?? parsedQuery.data.requestedDays,
        );
        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
