import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { userRepository } from '../modules/auth/repositories/user.repository';
import config from '../config/env';
import { PlatformRole } from '../db/schema';
import { AuthenticationError, AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: PlatformRole;
  };
}

/**
 * Validates Supabase JWT Bearer token from the Authorization header.
 * Resolves user platform role from trusted server database, never client metadata.
 * Attaches user information to req.user upon successful verification.
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

  // 1. Try local JWT token verification if local auth is enabled in this environment
  if (config.env.enableLocalAuth) {
    try {
      const { verifyJwtToken } = await import('../utils/local-auth');
      const localPayload = verifyJwtToken(token);
      if (localPayload && localPayload.id) {
        const { mongoUserRepository } = await import('../modules/auth/repositories/mongo-user.repository');
        let mongoUser = null;
        try {
          mongoUser = await mongoUserRepository.findBySupabaseId(localPayload.id);
        } catch (dbErr: any) {
          console.error('[authMiddleware] Database error during local user lookup:', dbErr);
          return next(new AppError('Unable to verify user profile due to database error.', 500));
        }

        if (!mongoUser) {
          return next(new AuthenticationError('Invalid authentication token. User profile not found.'));
        }

        if (mongoUser.status === 'SUSPENDED') {
          return next(new AuthenticationError('Account is suspended. Please contact platform administrators.'));
        }

        req.user = {
          id: mongoUser.supabaseUserId,
          email: mongoUser.email,
          role: mongoUser.platformRole,
        };
        return next();
      }
    } catch (err: any) {
      if (err instanceof AppError || err instanceof AuthenticationError) {
        return next(err);
      }
      // If local token parsing failed, proceed to Supabase verification
    }
  }

  // 2. Fall back to Supabase verification if configured
  if (!supabaseAdmin) {
    return next(new AuthenticationError('Invalid or expired authentication token.'));
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new AuthenticationError('Invalid or expired authentication token.'));
    }

    const email = (user.email || '').toLowerCase().trim();

    // Resolve application platform role from trusted server database record
    let userRole: PlatformRole = 'USER';
    try {
      const { isMongoConnected } = await import('../db/mongodb');
      const mongoConfigured = Boolean(config.env.mongoUri);

      // In production, the authoritative MongoDB role store is mandatory. Fail closed!
      if (config.env.isProduction && mongoConfigured && !isMongoConnected()) {
        console.error('[authMiddleware] Authoritative MongoDB role store is configured but disconnected.');
        return next(new AppError('Unable to verify user profile due to database error.', 500));
      }

      let mongoUser: any = null;
      try {
        const { mongoUserRepository } = await import('../modules/auth/repositories/mongo-user.repository');
        mongoUser = await mongoUserRepository.findBySupabaseId(user.id);
        if (!mongoUser && email) {
          mongoUser = await mongoUserRepository.findByEmail(email);
        }
      } catch (mErr) {
        if (config.env.isProduction) {
          throw mErr;
        }
      }

      if (mongoUser) {
        if (mongoUser.status === 'SUSPENDED') {
          return next(new AuthenticationError('Account is suspended. Please contact platform administrators.'));
        }
        userRole = mongoUser.platformRole;
      } else if (isMongoConnected()) {
        // Connected to MongoDB but no profile exists: reject unauthenticated access
        return next(
          new AuthenticationError(
            'User profile not found. Please register for a Ticketification account.',
            undefined,
            'ACCOUNT_NOT_FOUND'
          )
        );
      } else if (config.env.isProduction && mongoConfigured) {
        return next(new AppError('Unable to verify user profile due to database error.', 500));
      } else {
        // Fall back to PostgreSQL in legacy non-production environments
        let dbUser = await userRepository.findById(user.id);
        if (!dbUser && email) {
          dbUser = await userRepository.findByEmail(email);
        }
        if (!dbUser) {
          return next(
            new AuthenticationError(
              'User profile not found. Please register for a Ticketification account.',
              undefined,
              'ACCOUNT_NOT_FOUND'
            )
          );
        }
        if ((dbUser as any)?.status === 'SUSPENDED') {
          return next(new AuthenticationError('Account is suspended. Please contact platform administrators.'));
        }
        // A PostgreSQL fallback must never grant an elevated role that contradicts the authoritative platform role store!
        if (dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN') {
          userRole = 'USER';
        } else {
          userRole = (dbUser.role as PlatformRole) || 'USER';
        }
      }
    } catch (syncErr: any) {
      if (syncErr instanceof AuthenticationError) {
        return next(syncErr);
      }
      console.error('[authMiddleware] Profile lookup/sync error:', syncErr);
      return next(new AppError('Unable to verify user profile due to database error.', 500));
    }

    req.user = {
      id: user.id,
      email,
      role: userRole,
    };

    next();
  } catch (err: any) {
    if (err instanceof AppError || err instanceof AuthenticationError) {
      return next(err);
    }
    return next(new AuthenticationError('Authentication failed. Please sign in again.'));
  }
}

export const authenticateUser = authMiddleware;
export default authMiddleware;
