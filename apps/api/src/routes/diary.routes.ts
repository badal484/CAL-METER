import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';
import { DiaryService } from '../services/diary.service.js';
import {
  CreateDiaryEntryRequestSchema,
  UpdateMealFoodItemRequestSchema,
  IsoDateStringSchema,
  UuidSchema,
} from '@calmeter/contracts';
import { formatDateToIso } from '@calmeter/shared';
import { z } from 'zod';

export interface DiaryRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  diaryService?: DiaryService;
}

const DateParamSchema = z.object({
  date: IsoDateStringSchema,
});

const EntryIdParamSchema = z.object({
  id: UuidSchema,
});

export function createDiaryRouter(options?: DiaryRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const diaryService = options?.diaryService || new DiaryService({ prisma });

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * GET /diary/summary/:date
   * Retrieves high-level daily nutrition summary with targets and progress.
   */
  router.get(
    '/summary/:date',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dateStr = req.params.date as string;
        const parsed = DateParamSchema.safeParse({ date: dateStr });
        if (!parsed.success) {
          throw parsed.error;
        }

        const userId = await getUserId(req);
        const summary = await diaryService.getDailySummary(userId, parsed.data.date);

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
   * GET /diary/:date
   * Retrieves full daily diary for date, with all meals, food items, and totals.
   */
  router.get('/:date', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      let dateStr = req.params.date as string;
      if (dateStr === 'today') {
        dateStr = formatDateToIso(new Date());
      }

      const parsed = DateParamSchema.safeParse({ date: dateStr });
      if (!parsed.success) {
        throw parsed.error;
      }

      const userId = await getUserId(req);
      const diary = await diaryService.getDailyDiary(userId, parsed.data.date);

      res.status(200).json({
        success: true,
        data: diary,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /diary/entries
   * Logs one or multiple food items into a meal entry for a date.
   */
  router.post(
    '/entries',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = CreateDiaryEntryRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const result = await diaryService.createDiaryEntry(userId, parsed.data);

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
   * GET /diary/entries/:id
   * Retrieves a single logged food item by id.
   */
  router.get(
    '/entries/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = EntryIdParamSchema.safeParse({ id: req.params.id });
        if (!parsed.success) {
          throw parsed.error;
        }

        const userId = await getUserId(req);
        const item = await diaryService.getMealFoodItem(userId, parsed.data.id);

        res.status(200).json({
          success: true,
          data: item,
        });
      } catch (err) {
        if (
          (err as Error)?.message?.includes('not found') ||
          (err as Error)?.message?.includes('belongs to another user')
        ) {
          return next(new NotFoundError('Diary entry not found.'));
        }
        next(err);
      }
    },
  );

  /**
   * PATCH /diary/entries/:id
   * Updates an existing logged food item (portion, serving, food item).
   */
  router.patch(
    '/entries/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const idParsed = EntryIdParamSchema.safeParse({ id: req.params.id });
        if (!idParsed.success) {
          throw idParsed.error;
        }

        const bodyParsed = UpdateMealFoodItemRequestSchema.safeParse(req.body);
        if (!bodyParsed.success) {
          throw bodyParsed.error;
        }

        const userId = await getUserId(req);
        const result = await diaryService.updateMealFoodItem(
          userId,
          idParsed.data.id,
          bodyParsed.data,
        );

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        if (
          (err as Error)?.message?.includes('not found') ||
          (err as Error)?.message?.includes('belongs to another user')
        ) {
          return next(new NotFoundError('Diary entry not found.'));
        }
        next(err);
      }
    },
  );

  /**
   * DELETE /diary/entries/:id
   * Removes a logged food item and recalculates meal totals.
   */
  router.delete(
    '/entries/:id',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const idParsed = EntryIdParamSchema.safeParse({ id: req.params.id });
        if (!idParsed.success) {
          throw idParsed.error;
        }

        const userId = await getUserId(req);
        const result = await diaryService.deleteMealFoodItem(userId, idParsed.data.id);

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        if (
          (err as Error)?.message?.includes('not found') ||
          (err as Error)?.message?.includes('belongs to another user')
        ) {
          return next(new NotFoundError('Diary entry not found.'));
        }
        next(err);
      }
    },
  );

  return router;
}

export const defaultDiaryRouter = createDiaryRouter();
