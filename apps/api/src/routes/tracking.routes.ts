import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { TrackingService } from '../services/tracking.service.js';
import {
  LogWeightSchema,
  UpdateWeightLogSchema,
  LogWaterSchema,
  UpdateWaterLogSchema,
  LogExerciseSchema,
  UpdateExerciseLogSchema,
  ProgressQuerySchema,
  IsoDateStringSchema,
  UuidSchema,
} from '@calmeter/contracts';
import { z } from 'zod';

export interface TrackingRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  trackingService?: TrackingService;
}

const IdParamSchema = z.object({
  id: UuidSchema,
});

const DateParamSchema = z.object({
  date: IsoDateStringSchema,
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

  // ============================================================================
  // 1. WEIGHT TRACKING
  // ============================================================================

  /**
   * POST /tracking/weight
   * Logs a new body weight reading and updates user profile current weight.
   */
  router.post(
    '/weight',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = LogWeightSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const result = await trackingService.logWeight(userId, parsed.data);
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
   * GET /tracking/weight/summary
   * Derives weight statistics, trends, and progress towards goal.
   */
  router.get(
    '/weight/summary',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
        const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

        const summary = await trackingService.getWeightSummary(userId, { startDate, endDate });
        res.status(200).json({
          success: true,
          data: summary,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /tracking/weight
   * Retrieves historical weight logs for the user.
   */
  router.get('/weight', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const history = await trackingService.getWeightHistory(userId, { startDate, endDate, limit });
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /tracking/weight/:id
   * Updates an existing weight measurement and recalculates profile weight if applicable.
   */
  router.patch(
    '/weight/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = IdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const bodyParsed = UpdateWeightLogSchema.safeParse(req.body);
        if (!bodyParsed.success) {
          throw bodyParsed.error;
        }

        const updated = await trackingService.updateWeightLog(
          userId,
          paramParsed.data.id,
          bodyParsed.data,
        );
        res.status(200).json({
          success: true,
          data: updated,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /tracking/weight/:id
   * Deletes a weight measurement.
   */
  router.delete(
    '/weight/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = IdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const result = await trackingService.deleteWeightLog(userId, paramParsed.data.id);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ============================================================================
  // 2. WATER TRACKING
  // ============================================================================

  /**
   * POST /tracking/water
   * Logs a water intake entry in milliliters.
   */
  router.post('/water', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const parsed = LogWaterSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const result = await trackingService.logWater(userId, parsed.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /tracking/water/summary/:date
   * Retrieves daily water progress and summary against target for a specific date (YYYY-MM-DD).
   */
  router.get(
    '/water/summary/:date',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = DateParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const summary = await trackingService.getWaterSummaryForDate(userId, paramParsed.data.date);
        res.status(200).json({
          success: true,
          data: summary,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /tracking/water/:date
   * Retrieves individual water log entries for a specific date (YYYY-MM-DD).
   */
  router.get(
    '/water/:date',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = DateParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const entries = await trackingService.getWaterEntriesForDate(userId, paramParsed.data.date);
        res.status(200).json({
          success: true,
          data: entries,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /tracking/water/:id
   * Updates an existing water log entry.
   */
  router.patch(
    '/water/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = IdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const bodyParsed = UpdateWaterLogSchema.safeParse(req.body);
        if (!bodyParsed.success) {
          throw bodyParsed.error;
        }

        const updated = await trackingService.updateWaterLog(
          userId,
          paramParsed.data.id,
          bodyParsed.data,
        );
        res.status(200).json({
          success: true,
          data: updated,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /tracking/water/:id
   * Deletes an existing water log entry.
   */
  router.delete(
    '/water/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = IdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const result = await trackingService.deleteWaterLog(userId, paramParsed.data.id);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ============================================================================
  // 3. EXERCISE TRACKING
  // ============================================================================

  /**
   * POST /tracking/exercise
   * Logs a physical exercise activity with optional automated MET calorie estimation.
   */
  router.post(
    '/exercise',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = LogExerciseSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const result = await trackingService.logExercise(userId, parsed.data);
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
   * GET /tracking/exercise
   * Retrieves exercise activities with optional filtering by date, range, and limit.
   */
  router.get(
    '/exercise',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const date = req.query.date ? String(req.query.date) : undefined;
        const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
        const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

        const exercises = await trackingService.getExercises(userId, {
          date,
          startDate,
          endDate,
          limit,
        });
        res.status(200).json({
          success: true,
          data: exercises,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /tracking/exercise/:id
   * Updates an existing exercise activity.
   */
  router.patch(
    '/exercise/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = IdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const bodyParsed = UpdateExerciseLogSchema.safeParse(req.body);
        if (!bodyParsed.success) {
          throw bodyParsed.error;
        }

        const updated = await trackingService.updateExerciseLog(
          userId,
          paramParsed.data.id,
          bodyParsed.data,
        );
        res.status(200).json({
          success: true,
          data: updated,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /tracking/exercise/:id
   * Deletes an exercise activity.
   */
  router.delete(
    '/exercise/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const paramParsed = IdParamSchema.safeParse(req.params);
        if (!paramParsed.success) {
          throw paramParsed.error;
        }

        const result = await trackingService.deleteExerciseLog(userId, paramParsed.data.id);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ============================================================================
  // 4. PROGRESS REPORT
  // ============================================================================

  /**
   * GET /tracking/progress
   * Aggregates multi-metric progress reports over customizable timeframes.
   */
  router.get(
    '/progress',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const queryParsed = ProgressQuerySchema.safeParse(req.query);
        if (!queryParsed.success) {
          throw queryParsed.error;
        }

        const report = await trackingService.getProgressReport(userId, queryParsed.data);
        res.status(200).json({
          success: true,
          data: report,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
