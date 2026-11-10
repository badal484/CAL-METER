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
import { createCoachRouter } from './coach.routes.js';
import { createSubscriptionRouter } from './subscription.routes.js';
import { createWebhookRouter } from './webhook.routes.js';
import { createNotificationRoutes } from './notification.routes.js';
import { createAnalyticsRoutes } from './analytics.routes.js';
import { createMetricsRoutes } from './metrics.routes.js';
import { createAdminRoutes } from './admin.routes.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';
import type { BarcodeLookupService } from '../services/barcode/barcodeLookup.service.js';
import type { IPushNotificationProvider } from '../services/notificationDispatcher.service.js';

export interface RouteOptions {
  verifier?: IFirebaseTokenVerifier;
  prisma?: PrismaClient;
  foodRouter?: Router;
  barcodeService?: BarcodeLookupService;
  coachRouter?: Router;
  subscriptionRouter?: Router;
  webhookRouter?: Router;
  notificationRouter?: Router;
  analyticsRouter?: Router;
  adminRouter?: Router;
  pushProvider?: IPushNotificationProvider;
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
  v1Router.use(
    '/coach',
    options?.coachRouter ||
      createCoachRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/subscriptions',
    options?.subscriptionRouter ||
      createSubscriptionRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/webhooks',
    options?.webhookRouter || createWebhookRouter({ prisma: options?.prisma }),
  );
  v1Router.use(
    '/notifications',
    options?.notificationRouter ||
      createNotificationRoutes({
        verifier: options?.verifier,
        prisma: options?.prisma,
        pushProvider: options?.pushProvider,
      }),
  );
  v1Router.use(
    '/analytics',
    options?.analyticsRouter ||
      createAnalyticsRoutes({
        verifier: options?.verifier,
        prisma: options?.prisma,
      }),
  );
  v1Router.use('/metrics', createMetricsRoutes());
  v1Router.use(
    '/admin',
    options?.adminRouter ||
      createAdminRoutes({
        verifier: options?.verifier,
        prisma: options?.prisma,
        pushProvider: options?.pushProvider,
      }),
  );

  rootRouter.use('/api/v1', v1Router);

  return rootRouter;
}

export const rootRouter = createRootRouter();
