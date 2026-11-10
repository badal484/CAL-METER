import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { healthRouter } from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createFoodRouter } from './food.routes.js';
import { createScanRouter } from './scan.routes.js';
import { createDiaryRouter } from './diary.routes.js';
import { createProfileRouter } from './profile.routes.js';
import { createOnboardingRouter } from './onboarding.routes.js';
import { createGoalRouter } from './goal.routes.js';
import { createTrackingRouter } from './tracking.routes.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';
import type { BarcodeLookupService } from '../services/barcode/barcodeLookup.service.js';

export interface RouteOptions {
  verifier?: IFirebaseTokenVerifier;
  prisma?: PrismaClient;
  foodRouter?: Router;
  barcodeService?: BarcodeLookupService;
}

export function createRootRouter(options?: RouteOptions): Router {
  const rootRouter = Router();

  // Process & infrastructure liveness / readiness probes
  rootRouter.use('/', healthRouter);

  // Version 1 API routes
  const v1Router = Router();
  v1Router.use('/auth', createAuthRouter(options?.verifier));
  v1Router.use(
    '/foods',
    options?.foodRouter ||
      createFoodRouter({
        verifier: options?.verifier,
        prisma: options?.prisma,
        barcodeService: options?.barcodeService,
      }),
  );
  v1Router.use(
    '/scans',
    createScanRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/diary',
    createDiaryRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/profile',
    createProfileRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/onboarding',
    createOnboardingRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/goals',
    createGoalRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/tracking',
    createTrackingRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );

  rootRouter.use('/api/v1', v1Router);
  return rootRouter;
}

export const rootRouter = createRootRouter();
