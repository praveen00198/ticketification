import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { userRepository } from '../modules/auth/repositories/user.repository';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Validates Supabase JWT token from Authorization header.
 * Extracts user ID and email from the token payload.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Provide a valid Bearer token.', 401));
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('Authentication required. Bearer token is empty.', 401));
  }

  if (!supabaseAdmin) {
    return next(new AppError('Authentication service not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 503));
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new AppError('Invalid or expired authentication token.', 401));
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'ADMIN',
    };

    // Ensure the user row exists in public.users to fulfill foreign key constraints
    try {
      await userRepository.upsert({
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Admin',
        email: user.email || '',
        role: user.user_metadata?.role || 'ADMIN',
      });
    } catch (syncErr) {
      console.warn('[authMiddleware] Could not sync user to public.users:', syncErr);
    }

    next();
  } catch (error) {
    return next(new AppError('Authentication failed. Please sign in again.', 401));
  }
}
