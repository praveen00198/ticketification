import { Request, Response, NextFunction } from 'express';
import config from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;
  public isAppError = true;
  public errorCode?: string;

  constructor(message: string, statusCode: number = 500, details?: any, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = errorCode;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, details, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required or token expired.', details?: any) {
    super(message, 401, details, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action.', details?: any) {
    super(message, 403, details, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found.', details?: any) {
    super(message, 404, details, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, details, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class StorageError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, details, 'STORAGE_ERROR');
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed.', details?: any) {
    super(message, 500, details, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError =
    err instanceof AppError ||
    err?.isAppError === true ||
    (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599);

  const statusCode = isAppError ? err.statusCode || 400 : 500;
  let message = err?.message || 'An unexpected internal server error occurred.';
  const errorCode = err?.errorCode || (statusCode === 401 ? 'AUTHENTICATION_ERROR' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');

  if (statusCode >= 500) {
    console.error(`[Ticketification Server Error] ${req.method} ${req.path} - ${statusCode} [${errorCode}]: ${message}`, err?.stack || err);
  }

  // Filter out low-level technical infrastructure messages from end users
  if (
    message.includes('ENETUNREACH') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNRESET') ||
    message.includes('getaddrinfo')
  ) {
    message = 'Database or network service is currently unreachable. Please try again shortly.';
  } else if (message.includes('relation') && message.includes('does not exist')) {
    message = 'Database service initialization error. Please contact the administrator.';
  } else if (statusCode === 500 && !isAppError) {
    message = 'A server error occurred. Please try again or contact support.';
  }

  const details =
    err?.details ||
    (!config.env.isProduction || process.env.EXPOSE_ERROR_DETAILS === 'true'
      ? { originalMessage: err?.message, code: errorCode }
      : undefined);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: errorCode,
      ...(details && { details }),
    },
  });
}

