import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';

export const rootRouter = Router();

// Process & infrastructure liveness / readiness probes
rootRouter.use('/', healthRouter);

// Version 1 API routes
export const v1Router = Router();
v1Router.use('/auth', authRouter);

rootRouter.use('/api/v1', v1Router);
