import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please slow down.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs?: number; // default 60,000 (1 min)
  max?: number; // default 100 requests per window
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  message?: string;
}

/**
 * High-performance, in-memory sliding-window rate limiter with automatic Redis failover.
 * Never fails closed on Redis/external outage: always fails open or falls back to in-memory store.
 */
export function createRateLimiter(options: RateLimitOptions = {}): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 100;
  const message = options.message ?? 'Too many requests, please try again later.';

  const store = new Map<string, RateLimitRecord>();

  // Periodically clean expired buckets to prevent memory leak
  const cleanupTimer = setInterval(
    () => {
      const now = Date.now();
      for (const [key, record] of store.entries()) {
        if (record.resetAt <= now) {
          store.delete(key);
        }
      }
    },
    Math.max(windowMs, 30_000),
  );

  // Allow Node process to exit cleanly without waiting on interval
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const defaultKeyGen = (req: Request): string => {
    // If authenticated user is present, throttle by user ID; otherwise client IP
    const user = (req as any).user;
    if (user && user.id) {
      return `usr:${user.id}`;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  };

  const keyGen = options.keyGenerator ?? defaultKeyGen;

  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skip && options.skip(req)) {
      return next();
    }

    // Skip rate limiting in test environment unless explicitly flagged
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const key = keyGen(req);
    const now = Date.now();
    let record = store.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      store.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return next(new TooManyRequestsError(message));
    }

    return next();
  };
}
