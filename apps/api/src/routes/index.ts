import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { healthRouter } from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createFoodRouter } from './food.routes.js';
import { createScanRouter } from './scan.routes.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';

export interface RouteOptions {
  verifier?: IFirebaseTokenVerifier;
  prisma?: PrismaClient;
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
    createFoodRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );
  v1Router.use(
    '/scans',
    createScanRouter({ verifier: options?.verifier, prisma: options?.prisma }),
  );

  rootRouter.use('/api/v1', v1Router);
  return rootRouter;
}

export const rootRouter = createRootRouter();
