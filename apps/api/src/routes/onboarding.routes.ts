import { Router, Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getFirebaseTokenVerifier, type IFirebaseTokenVerifier } from '../lib/firebase.js';
import { resolveInternalUserId } from '../lib/userResolver.js';
import { ValidationError } from '../lib/errors.js';
import { ProfileService } from '../services/profile.service.js';
import { OnboardingDataSchema } from '@calmeter/contracts';

export interface OnboardingRouterOptions {
  prisma?: PrismaClient;
  verifier?: IFirebaseTokenVerifier;
  profileService?: ProfileService;
}

export function createOnboardingRouter(options?: OnboardingRouterOptions): Router {
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
   * POST /onboarding/complete
   * Idempotently completes the onboarding process, computes personalized targets,
   * creates/updates the UserProfile, and inserts the initial NutritionGoal.
   */
  router.post(
    '/complete',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = await getUserId(req);
        const parsed = OnboardingDataSchema.safeParse(req.body);
        if (!parsed.success) {
          throw parsed.error;
        }

        const result = await profileService.completeOnboarding(userId, parsed.data);
        res.status(201).json({
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
