import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../modules/auth/repositories/user.repository';
import config from '../config/env';
import { PlatformRole } from '../db/schema';
import { AuthenticationError, AppError } from './error.middleware';
import { verifyJwtToken } from '../utils/local-auth';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: PlatformRole;
  };
}

/**
 * Validates custom backend-issued JWT Bearer token from the Authorization header.
 * Resolves user platform role directly from authoritative MongoDB role store.
 * Never trusts client metadata or client-supplied roles.
 * Attaches verified user information to req.user upon successful verification.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Authentication required. Missing Bearer token.'));
  }

  const token = authHeader.split(' ')[1]?.trim();

  if (!token) {
    return next(new AuthenticationError('Authentication required. Bearer token is empty.'));
  }

  // 1. Verify custom backend JWT access token
  const payload = verifyJwtToken(token);
  if (!payload || !payload.id) {
    return next(new AuthenticationError('Invalid or expired authentication token.'));
  }

  const userId = String(payload.id);
  const email = (payload.email || '').toLowerCase().trim();

  // 2. Resolve user from authoritative MongoDB role store
  try {
    const { isMongoConnected } = await import('../db/mongodb');
    const mongoConfigured = Boolean(config.env.mongoUri);

    // In production, the authoritative MongoDB role store is mandatory. Fail closed!
    if (config.env.isProduction && mongoConfigured && !isMongoConnected()) {
      console.error('[authMiddleware] Authoritative MongoDB role store is configured but disconnected in production.');
      return next(new AppError('Unable to verify user profile due to database error.', 500));
    }

    let mongoUser: any = null;
    if (isMongoConnected()) {
      const { mongoUserRepository } = await import('../modules/auth/repositories/mongo-user.repository');
      mongoUser = await mongoUserRepository.findById(userId);
    }

    if (mongoUser) {
      if (mongoUser.status === 'SUSPENDED') {
        return next(new AuthenticationError('Account is suspended. Please contact platform administrators.'));
      }

      req.user = {
        id: String(mongoUser.supabaseUserId || mongoUser._id),
        email: mongoUser.email,
        role: mongoUser.platformRole || 'USER',
      };
      return next();
    }

    // If connected to MongoDB but user profile does not exist: reject!
    if (isMongoConnected()) {
      return next(
        new AuthenticationError(
          'User profile not found. Please register for a Ticketification account.',
          undefined,
          'ACCOUNT_NOT_FOUND'
        )
      );
    }

    // In production, fail closed if Mongo is configured but disconnected
    if (config.env.isProduction && mongoConfigured) {
      return next(new AppError('Unable to verify user profile due to database error.', 500));
    }

    // Fall back to PostgreSQL in non-production/test environments when MongoDB is not connected
    if (config.env.databaseUrl) {
      const dbUser = await userRepository.findById(userId);

      if (dbUser) {
        if ((dbUser as any)?.status === 'SUSPENDED') {
          return next(new AuthenticationError('Account is suspended. Please contact platform administrators.'));
        }

        const safeRole =
          dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN'
            ? 'USER'
            : ((dbUser.role as PlatformRole) || 'USER');

        req.user = {
          id: dbUser.id,
          email: dbUser.email,
          role: safeRole,
        };
        return next();
      }
    }

    // If payload has email and role in test environment where DB is unconfigured, allow safe test resolution
    if (!config.env.isProduction && payload.email) {
      req.user = {
        id: userId,
        email: payload.email,
        role: (payload.role as PlatformRole) || 'USER',
      };
      return next();
    }

    return next(
      new AuthenticationError(
        'User profile not found. Please register for a Ticketification account.',
        undefined,
        'ACCOUNT_NOT_FOUND'
      )
    );
  } catch (err: any) {
    if (err instanceof AuthenticationError || err instanceof AppError) {
      return next(err);
    }
    console.error('[authMiddleware] Profile verification error:', err);
    return next(new AppError('Unable to verify user profile due to database error.', 500));
  }
}

export const authenticateUser = authMiddleware;
export const requireAuth = authMiddleware;
export default authMiddleware;
