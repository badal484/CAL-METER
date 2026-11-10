import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError, type ErrorDetail } from '../lib/errors.js';

export function formatZodIssues(error: ZodError): ErrorDetail[] {
  return error.issues.map(issue => ({
    field: issue.path.length > 0 ? issue.path.join('.') : undefined,
    issue: issue.message,
  }));
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = formatZodIssues(result.error);
      return next(new ValidationError('Invalid request body.', details));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = formatZodIssues(result.error);
      return next(new ValidationError('Invalid query parameters.', details));
    }
    Object.defineProperty(req, 'query', {
      value: result.data,
      configurable: true,
      enumerable: true,
      writable: true,
    });
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = formatZodIssues(result.error);
      return next(new ValidationError('Invalid route parameters.', details));
    }
    Object.defineProperty(req, 'params', {
      value: result.data,
      configurable: true,
      enumerable: true,
      writable: true,
    });
    next();
  };
}
