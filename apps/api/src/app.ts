import express, { type Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/logger.js';
import { createSecurityMiddleware } from './middleware/security.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { createRootRouter } from './routes/index.js';
import type { IFirebaseTokenVerifier } from './lib/firebase.js';
import type { IPushNotificationProvider } from './services/notificationDispatcher.service.js';
import { getConfig, type ParsedTrustProxy } from './config/env.js';

import type { Router } from 'express';
import type { BarcodeLookupService } from './services/barcode/barcodeLookup.service.js';

export interface CreateAppOptions {
  verifier?: IFirebaseTokenVerifier;
  customVerifier?: IFirebaseTokenVerifier;
  prisma?: PrismaClient;
  trustProxy?: ParsedTrustProxy;
  configureRoutes?: (app: Express) => void;
  barcodeService?: BarcodeLookupService;
  foodRouter?: Router;
  pushProvider?: IPushNotificationProvider;
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

  // Global rate limiter with automatic memory fallback
  app.use(createRateLimiter());

  // Application Routes with injected dependencies
  const verifier = options?.verifier ?? options?.customVerifier;
  const router = createRootRouter({
    verifier,
    prisma: options?.prisma,
    foodRouter: options?.foodRouter,
    barcodeService: options?.barcodeService,
    pushProvider: options?.pushProvider,
  });
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
