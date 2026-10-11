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

  // 1. Try local JWT token verification first (works with MongoDB local auth)
  try {
    const { verifyJwtToken } = await import('../utils/local-auth');
    const localPayload = verifyJwtToken(token);
    if (localPayload && localPayload.id) {
      const { mongoUserRepository } = await import('../modules/auth/repositories/mongo-user.repository');
      const mongoUser = await mongoUserRepository.findBySupabaseId(localPayload.id);
      if (mongoUser) {
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
    }
  } catch (err) {
    // Fall through to Supabase verification
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

    const email = (user.email || '').toLowerCase();
    const isApprovedAdmin = config.env.initialAdminEmails.includes(email);

    // Resolve application platform role from trusted server database record
    let userRole: PlatformRole = 'USER';
    try {
      let dbUser = await userRepository.findById(user.id);
      if (!dbUser) {
        const initialRole: PlatformRole = isApprovedAdmin ? 'ADMIN' : 'USER';
        dbUser = await userRepository.upsert({
          id: user.id,
          name: user.user_metadata?.name || email.split('@')[0] || 'User',
          email,
          role: initialRole,
        });
      } else if (isApprovedAdmin && dbUser.role === 'USER') {
        dbUser = await userRepository.updateRole(user.id, 'ADMIN');
      }

      if (dbUser && (dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN' || dbUser.role === 'USER')) {
        userRole = dbUser.role as PlatformRole;
      }
    } catch (syncErr) {
      console.warn('[authMiddleware] Profile lookup/sync warning:', syncErr);
      userRole = isApprovedAdmin ? 'ADMIN' : 'USER';
    }

    req.user = {
      id: user.id,
      email,
      role: userRole,
    };

    next();
  } catch (err: any) {
    return next(new AuthenticationError('Authentication failed. Please sign in again.'));
  }
}

export const authenticateUser = authMiddleware;
export default authMiddleware;
