import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AuthenticationError, AuthorizationError } from './error.middleware';
import { PlatformRole } from '../db/schema';

/**
 * Reusable role-based platform authorization middleware.
 * Verifies that the caller's server-controlled platform role is within the allowed roles.
 * Fails closed if req.user is missing (401) or role is insufficient / invalid (403).
 */
export function requireRole(...allowedRoles: PlatformRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.id) {
      return next(new AuthenticationError('Authentication required. Missing user session.'));
    }

    const userRole = req.user.role;

    if (!userRole) {
      return next(new AuthorizationError('Access denied. No platform role assigned.'));
    }

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AuthorizationError(
          `Access denied. Requires one of [${allowedRoles.join(', ')}] privileges.`
        )
      );
    }

    next();
  };
}

/**
 * Convenience middleware for operations requiring Platform Administrator (or Super Admin) privileges.
 */
export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

/**
 * Convenience middleware for operations strictly requiring Super Administrator privileges.
 */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
