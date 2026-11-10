import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{1,64}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];

  let requestId: string;
  if (typeof incomingId === 'string' && SAFE_REQUEST_ID_REGEX.test(incomingId)) {
    requestId = incomingId;
  } else {
    requestId = randomUUID();
  }

  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  req.log = logger.child({ reqId: requestId });

  next();
}
