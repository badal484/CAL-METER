export interface ErrorDetail {
  field?: string;
  issue: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details?: ErrorDetail[],
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters provided.', details?: ErrorDetail[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication credentials missing or invalid.') {
    super(message, 401, 'AUTH_UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to access this resource.') {
    super(message, 403, 'FORBIDDEN_RESOURCE');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found.') {
    super(message, 404, 'RESOURCE_NOT_FOUND');
  }
}

export class ProductNotFoundError extends AppError {
  constructor(message = 'No packaged product found matching the requested barcode.') {
    super(message, 404, 'PRODUCT_NOT_FOUND');
  }
}

export class ProviderTimeoutError extends AppError {
  constructor(message = 'Upstream product data provider timed out.') {
    super(message, 504, 'PROVIDER_TIMEOUT');
  }
}

export class DailyScanLimitReachedError extends AppError {
  constructor(message = 'Daily free AI food scan limit reached (maximum 3 scans per day).') {
    super(message, 429, 'DAILY_SCAN_LIMIT_REACHED');
  }
}

export class FeatureLimitExceededError extends AppError {
  public readonly feature: string;
  public readonly limit?: number;
  public readonly currentUsage?: number;
  public readonly upgradeUrl: string;

  constructor(
    message: string,
    feature: string,
    limit?: number,
    currentUsage?: number,
    upgradeUrl = '/paywall',
  ) {
    super(message, 403, 'FEATURE_LIMIT_EXCEEDED', [
      {
        feature,
        limit,
        currentUsage,
        upgradeUrl,
        issue: message,
      },
    ]);
    this.feature = feature;
    this.limit = limit;
    this.currentUsage = currentUsage;
    this.upgradeUrl = upgradeUrl;
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Request payload exceeds the permissible limit.') {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(message = 'Service dependency is temporarily unavailable.') {
    super(message, 503, 'DEPENDENCY_UNAVAILABLE');
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected internal server error occurred.') {
    super(message, 500, 'INTERNAL_SERVER_ERROR', undefined, false);
  }
}
