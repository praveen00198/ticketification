import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;
  public isAppError = true;

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
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
  const details = err?.details || undefined;

  console.error(`[API Error] ${req.method} ${req.path} - ${statusCode}: ${message}`, err?.stack || err);

  // Map low-level technical errors (e.g., socket, IPv6, network, raw DB) to user-friendly messages
  if (
    message.includes('ENETUNREACH') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNRESET') ||
    message.includes('getaddrinfo')
  ) {
    message = 'Database or network service is currently unreachable. Please check your connection or try again in a moment.';
  } else if (message.includes('relation') && message.includes('does not exist')) {
    message = 'Database service initialization error. Please contact the administrator.';
  } else if (statusCode === 500 && !isAppError) {
    message = err?.message ? `Server Error: ${err.message}` : 'A server error occurred. Please try again or contact support.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details && { details }),
    },
  });
}

