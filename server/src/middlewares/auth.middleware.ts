import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { userRepository } from '../modules/auth/repositories/user.repository';
import { AuthenticationError, AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Validates Supabase JWT Bearer token from the Authorization header.
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

  if (!supabaseAdmin) {
    return next(
      new AppError('Authentication service is unavailable. Check server environment.', 503)
    );
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new AuthenticationError('Invalid or expired authentication token.'));
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'ADMIN',
    };

    // Ensure user record exists in public.users to satisfy database foreign keys
    try {
      await userRepository.upsert({
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Admin',
        email: user.email || '',
        role: user.user_metadata?.role || 'ADMIN',
      });
    } catch (syncErr) {
      console.warn('[authMiddleware] Profile sync note:', syncErr);
    }

    next();
  } catch (err: any) {
    return next(new AuthenticationError('Authentication failed. Please sign in again.'));
  }
}
