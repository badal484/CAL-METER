import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { CoachService } from '../services/coach.service.js';
import { SendCoachMessageSchema, GetMealRecommendationsQuerySchema } from '@calmeter/contracts';
import { z } from 'zod';

export interface CoachRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  coachService?: CoachService;
}

const HistoryQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
});

export function createCoachRouter(options?: CoachRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const coachService = options?.coachService || new CoachService({ prisma });

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * POST /coach/message
   * Dispatches a user query to the AI Nutrition Coach and returns context-aware guidance.
   */
  router.post(
    '/message',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = SendCoachMessageSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const result = await coachService.sendMessage(userId, parsed.data.message);
        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /coach/history
   * Retrieves conversation history between user and AI Nutrition Coach.
   */
  router.get(
    '/history',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsedQuery = HistoryQuerySchema.safeParse(req.query);
        const limit = parsedQuery.success ? parsedQuery.data.limit : 50;

        const result = await coachService.getConversationHistory(userId, limit);
        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /coach/history
   * Clears conversation history for the authenticated user.
   */
  router.delete(
    '/history',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const result = await coachService.clearConversationHistory(userId);
        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /coach/insights
   * Evaluates deterministic personalized insights based on authentic food and tracking data.
   */
  router.get(
    '/insights',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const forceRefresh = req.query.forceRefresh === 'true';

        const result = await coachService.getPersonalizedInsights(userId, forceRefresh);
        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /coach/recommendations
   * Generates tailored meal suggestions matching remaining calories, macros, and preferences.
   */
  router.get(
    '/recommendations',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsedQuery = GetMealRecommendationsQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          throw parsedQuery.error;
        }

        const result = await coachService.getMealRecommendations(
          userId,
          parsedQuery.data.mealType,
          parsedQuery.data.date,
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
