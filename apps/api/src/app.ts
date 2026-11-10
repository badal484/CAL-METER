import express, { type Express } from 'express';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/logger.js';
import { createSecurityMiddleware } from './middleware/security.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { createRootRouter } from './routes/index.js';
import type { IFirebaseTokenVerifier } from './lib/firebase.js';
import { getConfig, type ParsedTrustProxy } from './config/env.js';

export interface CreateAppOptions {
  verifier?: IFirebaseTokenVerifier;
  customVerifier?: IFirebaseTokenVerifier;
  trustProxy?: ParsedTrustProxy;
  configureRoutes?: (app: Express) => void;
}

export function createApp(options?: CreateAppOptions): Express {
  const config = getConfig();
  const app = express();

  // Explicit Reverse Proxy Trust Configuration (default disabled / false)
  const effectiveTrustProxy =
    options?.trustProxy !== undefined ? options.trustProxy : config.parsedTrustProxy;

  if (effectiveTrustProxy !== false) {
    app.set('trust proxy', effectiveTrustProxy);
  } else {
    app.set('trust proxy', false);
  }

  // Request ID & Structured Logging Context
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Security headers, CORS, body parsers
  const securityMiddlewares = createSecurityMiddleware();
  securityMiddlewares.forEach(middleware => app.use(middleware));

  // Application Routes with injected dependencies
  const verifier = options?.verifier ?? options?.customVerifier;
  const router = createRootRouter({ verifier });
  app.use('/', router);

  // Optional custom test routes hook before error handlers
  if (options?.configureRoutes) {
    options.configureRoutes(app);
  }

  // 404 & Centralized Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
