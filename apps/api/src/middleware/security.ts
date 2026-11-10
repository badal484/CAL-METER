import helmet from 'helmet';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { getConfig } from '../config/env.js';
import { ForbiddenError } from '../lib/errors.js';

export function createSecurityMiddleware(): RequestHandler[] {
  const config = getConfig();

  const corsMiddleware = cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, server-to-server, curl)
      if (!origin) {
        return callback(null, true);
      }

      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new ForbiddenError(`Origin '${origin}' not permitted by CORS policy.`),
        false,
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    credentials: true,
  });

  return [
    helmet(),
    corsMiddleware,
    express.json({ limit: config.MAX_REQUEST_SIZE }),
    express.urlencoded({ extended: true, limit: config.MAX_REQUEST_SIZE }),
  ];
}
