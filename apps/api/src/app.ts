import express, { type Express } from 'express';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/logger.js';
import { createSecurityMiddleware } from './middleware/security.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { rootRouter } from './routes/index.js';
import type { IFirebaseTokenVerifier } from './lib/firebase.js';
import { setFirebaseTokenVerifierForTesting } from './lib/firebase.js';

export interface CreateAppOptions {
  customVerifier?: IFirebaseTokenVerifier;
  configureRoutes?: (app: Express) => void;
}

export function createApp(options?: CreateAppOptions): Express {
  if (options?.customVerifier) {
    setFirebaseTokenVerifierForTesting(options.customVerifier);
  }

  const app = express();

  // Basic settings
  app.set('trust proxy', 1);

  // Request ID & Structured Logging Context
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Security headers, CORS, body parsers
  const securityMiddlewares = createSecurityMiddleware();
  securityMiddlewares.forEach(middleware => app.use(middleware));

  // Application Routes
  app.use('/', rootRouter);

  // Optional custom test routes hook before error handlers
  if (options?.configureRoutes) {
    options.configureRoutes(app);
  }

  // 404 & Centralized Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
