import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { ProfileService } from '../services/profile.service.js';
import { UpdateUserProfileSchema } from '@calmeter/contracts';

export interface ProfileRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  profileService?: ProfileService;
}

export function createProfileRouter(options?: ProfileRouterOptions): Router {
  const router = Router();
  const prisma = options?.prisma || getPrismaClient();
  const verifier = options?.verifier || getFirebaseTokenVerifier();
  const authMiddleware = createAuthMiddleware(verifier);
  const profileService = options?.profileService || new ProfileService(prisma);

  async function getUserId(req: Request): Promise<string> {
    if (!req.user) {
      throw new ValidationError('Authentication required.');
    }
    return resolveInternalUserId(prisma, req.user);
  }

  /**
   * GET /profile
   * Retrieves the authenticated user's profile and body statistics.
   */
  router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const profile = await profileService.getProfile(userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /profile
   * Partially updates the authenticated user's profile.
   */
  router.patch('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = await getUserId(req);
      const parsed = UpdateUserProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const updated = await profileService.updateProfile(userId, parsed.data);
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
