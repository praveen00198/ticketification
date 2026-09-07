import { supabaseAdmin, supabasePublic } from '../../../config/supabase';
import { userRepository, UserRepository } from '../repositories/user.repository';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AppError,
} from '../../../middlewares/error.middleware';
import { RegisterInput, LoginInput, AuthResponse } from '../auth.types';

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { name, email, password } = input;

    if (!supabaseAdmin && !supabasePublic) {
      throw new AppError('Authentication service is not configured. Check server environment.', 503);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Create user in Supabase Auth via admin client
    const { data: authData, error: authError } = await supabaseAdmin!.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: 'ADMIN' },
    });

    if (authError) {
      if (
        authError.message.includes('already been registered') ||
        authError.message.includes('already exists')
      ) {
        throw new ConflictError('An account with this email address already exists. Please sign in.');
      }
      throw new ValidationError(`Registration failed: ${authError.message}`);
    }

    if (!authData.user) {
      throw new AppError('Registration failed: No user returned from auth service.', 500);
    }

    // Sync user profile to database
    try {
      await this.userRepo.upsert({
        id: authData.user.id,
        name: name.trim(),
        email: normalizedEmail,
        role: 'ADMIN',
      });
    } catch (dbErr) {
      console.warn('[AuthService] Could not sync user profile to database during registration:', dbErr);
    }

    // Sign in to obtain session token using public client to avoid mutating admin client
    const authClient = supabasePublic || supabaseAdmin!;
    const { data: sessionData, error: sessionError } = await authClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (sessionError || !sessionData.session) {
      return {
        user: {
          id: authData.user.id,
          name: name.trim(),
          email: normalizedEmail,
          role: 'ADMIN',
        },
        token: null,
        message: 'Account created successfully. Please sign in.',
      };
    }

    return {
      user: {
        id: authData.user.id,
        name: name.trim(),
        email: normalizedEmail,
        role: 'ADMIN',
      },
      token: sessionData.session.access_token,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    if (!supabaseAdmin && !supabasePublic) {
      throw new AppError('Authentication service is not configured. Check server environment.', 503);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Sign in user using public client to keep admin/storage clients untainted
    const authClient = supabasePublic || supabaseAdmin!;
    const { data, error } = await authClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });


    if (error) {
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('user_not_found')
      ) {
        throw new AuthenticationError('Invalid email or password. Please check your credentials and try again.');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new AuthenticationError('Email address has not been confirmed.');
      }
      throw new AuthenticationError(error.message);
    }

    if (!data.user || !data.session) {
      throw new AppError('Login failed: No active session was created.', 500);
    }

    // Ensure user profile exists in database
    let profileName = data.user.user_metadata?.name || 'Admin';
    try {
      const profile = await this.userRepo.upsert({
        id: data.user.id,
        name: data.user.user_metadata?.name || 'Admin',
        email: normalizedEmail,
        role: data.user.user_metadata?.role || 'ADMIN',
      });
      if (profile?.name) {
        profileName = profile.name;
      }
    } catch (dbErr) {
      console.warn('[AuthService] Could not sync user profile to database during login:', dbErr);
    }

    return {
      user: {
        id: data.user.id,
        name: profileName,
        email: normalizedEmail,
        role: data.user.user_metadata?.role || 'ADMIN',
      },
      token: data.session.access_token,
    };
  }

  async getMe(userId: string) {
    try {
      const user = await this.userRepo.findById(userId);
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }
    } catch (dbErr) {
      console.warn('[AuthService] Could not query user profile from DB:', dbErr);
    }

    // Fallback to Supabase Auth user record if database query failed
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (data?.user) {
        return {
          id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Admin',
          email: data.user.email || '',
          role: data.user.user_metadata?.role || 'ADMIN',
        };
      }
    }

    throw new NotFoundError('User profile not found.');
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long.');
    }

    if (!supabaseAdmin) {
      throw new AppError('Authentication service is not configured.', 503);
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new AppError(`Failed to update password: ${error.message}`, 400);
    }
  }
}

export const authService = new AuthService();
