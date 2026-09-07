import { supabaseAdmin } from '../../../config/supabase';
import { userRepository, UserRepository } from '../repositories/user.repository';
import { AppError } from '../../../middlewares/error.middleware';

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(name: string, email: string, password: string) {
    if (!name || !name.trim()) {
      throw new AppError('Full name is required.', 400);
    }
    if (!email || !email.trim()) {
      throw new AppError('Email address is required.', 400);
    }
    if (!password || password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }

    if (!supabaseAdmin) {
      throw new AppError('Authentication service not configured.', 503);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: 'ADMIN' },
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        throw new AppError('An account with this email address already exists. Please sign in.', 400);
      }
      throw new AppError(`Registration failed: ${authError.message}`, 400);
    }

    if (!authData.user) {
      throw new AppError('Registration failed: No user returned from auth service.', 500);
    }

    // Sync user profile to our users table (resilient to DB latency)
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

    // Sign in to get a session token
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (sessionError || !sessionData.session) {
      // User created but auto-login failed — they can login manually
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

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    if (!supabaseAdmin) {
      throw new AppError('Authentication service not configured.', 503);
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('user_not_found')
      ) {
        throw new AppError('Invalid email or password. Please check your credentials and try again.', 401);
      }
      if (error.message.includes('Email not confirmed')) {
        throw new AppError('Email address has not been confirmed. Please verify your email or check your Supabase Auth settings.', 401);
      }
      throw new AppError(error.message, 401);
    }

    if (!data.user || !data.session) {
      throw new AppError('Login failed: No active session was created.', 500);
    }

    // Ensure user profile exists in our table (resilient to DB connection)
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

    throw new AppError('User profile not found.', 404);
  }
}

export const authService = new AuthService();
