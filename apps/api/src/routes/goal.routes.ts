import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { GoalService } from '../services/goal.service.js';
import {
  CreateNutritionGoalRequestSchema,
  UpdateNutritionGoalSchema,
  RecalculateGoalsRequestSchema,
  UuidSchema,
  IsoDateStringSchema,
} from '@calmeter/contracts';
import { z } from 'zod';

export interface GoalRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  goalService?: GoalService;
}

const GoalIdParamSchema = z.object({
  id: UuidSchema,
});

const CurrentGoalQuerySchema = z.object({
  date: IsoDateStringSchema.optional(),
});

export function createGoalRouter(options?: GoalRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const goalService = options?.goalService || new GoalService(prisma);

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * GET /goals
   * Retrieves the historical list of nutrition goals for the authenticated user.
   */
  router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const history = await goalService.getGoalHistory(userId);
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /goals/current
   * Retrieves the active goal for a given date (or today).
   */
  router.get(
    '/current',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsedQuery = CurrentGoalQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          throw parsedQuery.error;
        }

        const current = await goalService.getCurrentGoal(userId, parsedQuery.data.date);
        res.status(200).json({
          success: true,
          data: current,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /goals
   * Creates a new personalized nutrition goal with an effective date.
   */
  router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const parsed = CreateNutritionGoalRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const created = await goalService.createGoal(userId, parsed.data);
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /goals/recalculate
   * Recalculates suggested BMR, TDEE, Calories, and Macros without saving to DB.
   */
  router.post(
    '/recalculate',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = RecalculateGoalsRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const suggestions = await goalService.recalculateGoals(userId, parsed.data);
        res.status(200).json({
          success: true,
          data: suggestions,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /goals/:id
   * Updates an existing nutrition goal.
   */
  router.patch('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const paramParsed = GoalIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw paramParsed.error;
      }

      const bodyParsed = UpdateNutritionGoalSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        throw bodyParsed.error;
      }

      const updated = await goalService.updateGoal(userId, paramParsed.data.id, bodyParsed.data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
