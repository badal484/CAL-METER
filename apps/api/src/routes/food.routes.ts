import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import {
  FoodSearchQuerySchema,
  CreateCustomFoodSchema,
  UpdateCustomFoodSchema,
  UuidSchema,
  type FoodSearchQuery,
  type CreateCustomFoodDto,
  type UpdateCustomFoodDto,
} from '@calmeter/contracts';
import { validateQuery, validateBody, validateParams } from '../middleware/validate.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getPrismaClient } from '../lib/prisma.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';
import { getFirebaseTokenVerifier } from '../lib/firebase.js';
import { FoodSearchService } from '../services/foodSearch.service.js';
import { FoodManagementService } from '../services/foodManagement.service.js';
import { resolveUserId } from '../lib/userResolver.js';

const IdParamSchema = z.object({
  id: UuidSchema,
});

export interface FoodRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
}

export function createFoodRouter(options?: FoodRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);

  const searchService = new FoodSearchService(prisma);
  const managementService = new FoodManagementService(prisma);

  /**
   * Helper middleware: optionally verifies Bearer token if provided,
   * without failing if missing. This allows authenticated users to see
   * their private custom foods in search and detail queries.
   */
  const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    try {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = await verifier.verifyIdToken(token);
        if (decoded.uid) {
          req.user = {
            uid: decoded.uid,
            email: decoded.email,
            emailVerified: decoded.emailVerified,
            name: decoded.name,
          };
        }
      }
    } catch {
      // Ignored for optional auth
    }
    next();
  };

  /**
   * GET /foods
   * Searches verified catalog foods and user's private custom foods.
   */
  router.get(
    '/',
    optionalAuth,
    validateQuery(FoodSearchQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = req.query as unknown as FoodSearchQuery;
        let resolvedUserUuid: string | undefined;

        if (req.user) {
          resolvedUserUuid = await resolveUserId(prisma, req.user);
        }

        const result = await searchService.searchFoods(query, resolvedUserUuid);

        res.status(200).json({
          success: true,
          data: result.items,
          meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /foods
   * Creates a private custom food item for the authenticated user.
   */
  router.post(
    '/',
    authMiddleware,
    validateBody(CreateCustomFoodSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as CreateCustomFoodDto;
        const resolvedUserUuid = await resolveUserId(prisma, req.user!);
        const created = await managementService.createCustomFood(resolvedUserUuid, body);

        res.status(201).json({
          success: true,
          data: created,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /foods/:id
   * Fetches full food details with complete nutrient profile, serving conversions,
   * aliases, and categories.
   */
  router.get(
    '/:id',
    optionalAuth,
    validateParams(IdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as { id: string };
        let resolvedUserUuid: string | undefined;

        if (req.user) {
          resolvedUserUuid = await resolveUserId(prisma, req.user);
        }

        const detail = await managementService.getFoodById(id, resolvedUserUuid);

        res.status(200).json({
          success: true,
          data: detail,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /foods/:id/servings
   * Returns registered serving conversions for a food item.
   */
  router.get(
    '/:id/servings',
    optionalAuth,
    validateParams(IdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as { id: string };
        let resolvedUserUuid: string | undefined;

        if (req.user) {
          resolvedUserUuid = await resolveUserId(prisma, req.user);
        }

        const detail = await managementService.getFoodById(id, resolvedUserUuid);

        res.status(200).json({
          success: true,
          data: detail.servingConversions,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * PATCH /foods/:id
   * Updates an existing custom food item.
   */
  router.patch(
    '/:id',
    authMiddleware,
    validateParams(IdParamSchema),
    validateBody(UpdateCustomFoodSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as { id: string };
        const body = req.body as UpdateCustomFoodDto;
        const resolvedUserUuid = await resolveUserId(prisma, req.user!);

        const updated = await managementService.updateCustomFood(id, resolvedUserUuid, body);

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
   * DELETE /foods/:id
   * Soft-deletes a custom food item.
   */
  router.delete(
    '/:id',
    authMiddleware,
    validateParams(IdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as { id: string };
        const resolvedUserUuid = await resolveUserId(prisma, req.user!);

        await managementService.deleteCustomFood(id, resolvedUserUuid);

        res.status(200).json({
          success: true,
          data: { message: 'Custom food item deleted successfully.' },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const foodRouter = createFoodRouter();
