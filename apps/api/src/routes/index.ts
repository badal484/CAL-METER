import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import type { IFirebaseTokenVerifier } from '../lib/firebase.js';

export interface RouteOptions {
  verifier?: IFirebaseTokenVerifier;
}

export function createRootRouter(options?: RouteOptions): Router {
  const rootRouter = Router();

  // Process & infrastructure liveness / readiness probes
  rootRouter.use('/', healthRouter);

  // Version 1 API routes
  const v1Router = Router();
  v1Router.use('/auth', createAuthRouter(options?.verifier));

  rootRouter.use('/api/v1', v1Router);
  return rootRouter;
}

export const rootRouter = createRootRouter();
