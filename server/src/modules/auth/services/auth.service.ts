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

    // Sync user profile to our users table
    const profile = await this.userRepo.upsert({
      id: authData.user.id,
      name: name.trim(),
      email: normalizedEmail,
      role: 'ADMIN',
    });

    // Sign in to get a session token
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    // For immediate login after registration, use signInWithPassword
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
      if (error.message.includes('Invalid login credentials')) {
        throw new AppError('Invalid email or password. Please check your credentials.', 401);
      }
      throw new AppError(`Login failed: ${error.message}`, 401);
    }

    if (!data.user || !data.session) {
      throw new AppError('Login failed: No session returned.', 500);
    }

    // Ensure user profile exists in our table
    const profile = await this.userRepo.upsert({
      id: data.user.id,
      name: data.user.user_metadata?.name || 'User',
      email: normalizedEmail,
      role: data.user.user_metadata?.role || 'ADMIN',
    });

    return {
      user: {
        id: data.user.id,
        name: profile?.name || data.user.user_metadata?.name || 'User',
        email: normalizedEmail,
        role: profile?.role || 'ADMIN',
      },
      token: data.session.access_token,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User profile not found.', 404);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

export const authService = new AuthService();
