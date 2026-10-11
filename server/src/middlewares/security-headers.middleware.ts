import { Request, Response, NextFunction } from 'express';

/**
 * Native, zero-dependency security headers middleware for Ticketification.
 * Implements OWASP and modern web security standards.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Disable deprecated buggy XSS auditor to prevent side-channel leaks
  res.setHeader('X-XSS-Protection', '0');

  // Enforce HTTPS HSTS for 1 year with subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Safe referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict unused permissions on backend origin
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Cross-Origin Isolation policies
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Remove Express fingerprint
  res.removeHeader('X-Powered-By');

  next();
}

export default securityHeadersMiddleware;
