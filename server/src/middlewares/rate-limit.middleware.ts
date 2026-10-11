import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * Creates an in-memory, zero-dependency sliding window rate limiter middleware.
 * Automatically evicts expired IP records to prevent memory growth.
 * Properly isolates authenticated users so one user's activity never exhausts another user's allowance behind a shared IP.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message } = options;
  const store = new Map<string, ClientRecord>();
  const MAX_STORE_SIZE = 10000; // Defense against unbounded memory consumption

  // Periodically sweep expired records every 60 seconds (unrefed so it doesn't block process exit)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 60000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine client identifier
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-client';

    // Properly scope limiter key:
    // 1. Explicit keyGenerator (e.g. per-endpoint custom isolation)
    // 2. Authenticated user ID (prevents NAT/shared-proxy starvation)
    // 3. Client IP fallback for unauthenticated requests
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req as any).user?.id
      ? `user:${(req as any).user.id}`
      : `ip:${clientIp}`;

    const now = Date.now();
    const existing = store.get(key);

    if (!existing || now > existing.resetTime) {
      if (store.size >= MAX_STORE_SIZE) {
        const oldestKey = store.keys().next().value;
        if (oldestKey) store.delete(oldestKey);
      }

      store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, max - existing.count);
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetTime - now) / 1000));

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(existing.resetTime / 1000));

    if (existing.count > max) {
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: message || 'Too many requests. Please slow down and try again shortly.',
          retryAfter: retryAfterSec,
        },
      });
      return;
    }

    next();
  };
}

// Preset Rate Limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 min per IP
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

export const scannerRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 180, // 180 scans per minute per scanner IP (3 scans/sec max)
  message: 'Scanner scan limit exceeded. Please wait a moment before scanning again.',
});

export const exportRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 export triggers per minute
  message: 'Export generation rate limit reached. Please wait before enqueuing additional export jobs.',
});

export const auditLogRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 queries per minute
  message: 'Audit log query limit exceeded. Please wait a moment before refreshing.',
});
