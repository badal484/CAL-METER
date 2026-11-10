import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError, type ErrorDetail } from '../lib/errors.js';
import { formatZodIssues } from './validate.js';
import { getConfig } from '../config/env.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Express error handler requires 4 parameters to be recognized as an error middleware
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const config = getConfig();
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal server error occurred.';
  let details: ErrorDetail[] | undefined = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed.';
    details = formatZodIssues(err);
  } else if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: number }).status === 400
  ) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Malformed JSON payload provided.';
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: string }).type === 'entity.too.large'
  ) {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload exceeds the permissible size limit.';
  } else {
    // Unhandled error
    const reqLogger = req.log;
    if (reqLogger) {
      reqLogger.error({ err }, 'Unhandled server exception');
    }

    if (!config.isProduction && err instanceof Error) {
      message = err.message;
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  });
}
