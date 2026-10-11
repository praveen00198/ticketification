import crypto from 'crypto';
import mongoose from 'mongoose';
import { supabaseAdmin, supabasePublic } from '../../../config/supabase';
import { userRepository, UserRepository } from '../repositories/user.repository';
import { mongoUserRepository, MongoUserRepository } from '../repositories/mongo-user.repository';
import { identitySyncService, IdentitySyncService } from './identity-sync.service';
import { hashPassword, verifyPassword, createJwtToken } from '../../../utils/local-auth';
import config from '../../../config/env';
import { PlatformRole } from '../../../db/schema';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AppError,
} from '../../../middlewares/error.middleware';
import { RegisterInput, LoginInput, AuthResponse } from '../auth.types';

export class AuthService {
  constructor(
    private userRepo: UserRepository = userRepository,
    private mongoUserRepo: MongoUserRepository = mongoUserRepository,
    private syncService: IdentitySyncService = identitySyncService
  ) {}

  private isApprovedAdmin(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return config.env.initialAdminEmails.includes(normalized);
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { name, email, password } = input;
    const normalizedEmail = email.trim().toLowerCase();
    const assignedRole: PlatformRole = this.isApprovedAdmin(normalizedEmail) ? 'ADMIN' : 'USER';

    // 1. If Supabase Auth is configured, use Supabase
    if (supabaseAdmin) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: name.trim(), role: assignedRole },
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

      try {
        await this.userRepo.upsert({
          id: authData.user.id,
          name: name.trim(),
          email: normalizedEmail,
          role: assignedRole,
        });
        this.syncService.syncUserToMongo({
          id: authData.user.id,
          name: name.trim(),
          email: normalizedEmail,
          role: assignedRole,
        }).catch(() => {});
      } catch (dbErr) {
        console.warn('[AuthService] Could not sync user profile to database during registration:', dbErr);
      }

      const authClient = supabasePublic || supabaseAdmin;
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
            role: assignedRole,
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
          role: assignedRole,
        },
        token: sessionData.session.access_token,
      };
    }

    // 2. Native MongoDB Auth (fallback when Supabase is not configured)
    const existingUser = await this.mongoUserRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists. Please sign in.');
    }

    const generatedId = 'usr_' + crypto.randomUUID().replace(/-/g, '');
    const pwdHash = hashPassword(password);

    const mongoUser = await this.mongoUserRepo.create({
      supabaseUserId: generatedId,
      email: normalizedEmail,
      name: name.trim(),
      platformRole: assignedRole,
      status: 'ACTIVE',
      passwordHash: pwdHash,
    });

    const token = createJwtToken({
      id: mongoUser.supabaseUserId,
      email: mongoUser.email,
      role: mongoUser.platformRole,
    });

    return {
      user: {
        id: mongoUser.supabaseUserId,
        name: mongoUser.name,
        email: mongoUser.email,
        role: mongoUser.platformRole,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. If Supabase is configured, authenticate via Supabase
    if (supabaseAdmin || supabasePublic) {
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

      let resolvedRole: PlatformRole = 'USER';
      let profileName = data.user.user_metadata?.name || normalizedEmail.split('@')[0] || 'User';

      try {
        let dbUser = await this.userRepo.findById(data.user.id);
        if (!dbUser) {
          const initialRole: PlatformRole = this.isApprovedAdmin(normalizedEmail) ? 'ADMIN' : 'USER';
          dbUser = await this.userRepo.upsert({
            id: data.user.id,
            name: profileName,
            email: normalizedEmail,
            role: initialRole,
          });
        } else if (this.isApprovedAdmin(normalizedEmail) && dbUser.role === 'USER') {
          dbUser = await this.userRepo.updateRole(data.user.id, 'ADMIN');
        }

        if (dbUser) {
          resolvedRole = (dbUser.role as PlatformRole) || 'USER';
          profileName = dbUser.name || profileName;
          this.syncService.syncUserToMongo(dbUser).catch(() => {});
        }
      } catch (dbErr) {
        console.warn('[AuthService] Could not resolve user profile from database during login:', dbErr);
        resolvedRole = this.isApprovedAdmin(normalizedEmail) ? 'ADMIN' : 'USER';
      }

      return {
        user: {
          id: data.user.id,
          name: profileName,
          email: normalizedEmail,
          role: resolvedRole,
        },
        token: data.session.access_token,
      };
    }

    // 2. Native MongoDB Auth Fallback
    const mongoUser = await this.mongoUserRepo.findByEmail(normalizedEmail);
    if (!mongoUser || !mongoUser.passwordHash || !verifyPassword(password, mongoUser.passwordHash)) {
      throw new AuthenticationError('Invalid email or password. Please check your credentials and try again.');
    }

    if (mongoUser.status === 'SUSPENDED') {
      throw new AuthenticationError('Account is suspended. Please contact platform administrators.');
    }

    const token = createJwtToken({
      id: mongoUser.supabaseUserId,
      email: mongoUser.email,
      role: mongoUser.platformRole,
    });

    return {
      user: {
        id: mongoUser.supabaseUserId,
        name: mongoUser.name,
        email: mongoUser.email,
        role: mongoUser.platformRole,
      },
      token,
    };
  }

  async getMe(userId: string) {
    // 1. Check MongoDB
    try {
      let mongoUser = await this.mongoUserRepo.findBySupabaseId(userId);
      if (!mongoUser && userId.includes('@')) {
        mongoUser = await this.mongoUserRepo.findByEmail(userId);
      }
      if (!mongoUser && mongoose.Types.ObjectId.isValid(userId)) {
        mongoUser = await this.mongoUserRepo.findById(userId);
      }

      if (mongoUser) {
        let isOnboarded = false;
        let organizationName: string | undefined = undefined;
        if (mongoUser.hostProfile?.organizationName) {
          isOnboarded = true;
          organizationName = mongoUser.hostProfile.organizationName;
        }

        return {
          id: mongoUser.supabaseUserId,
          name: mongoUser.name,
          email: mongoUser.email,
          role: mongoUser.platformRole || 'USER',
          isOnboarded,
          organizationName,
        };
      }
    } catch (mErr) {
      console.warn('[AuthService] MongoDB lookup failed in getMe:', mErr);
    }

    // 2. Check Postgres repository if configured
    try {
      const user = await this.userRepo.findById(userId);
      if (user) {
        this.syncService.syncUserToMongo(user).catch(() => {});
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'USER',
          isOnboarded: false,
        };
      }
    } catch (dbErr) {
      console.warn('[AuthService] Could not query user profile from DB:', dbErr);
    }

    // 3. Fallback to Supabase Auth if configured
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (data?.user) {
        const email = (data.user.email || '').toLowerCase();
        const fallbackRole: PlatformRole = this.isApprovedAdmin(email) ? 'ADMIN' : 'USER';
        return {
          id: data.user.id,
          name: data.user.user_metadata?.name || email.split('@')[0] || 'User',
          email,
          role: fallbackRole,
          isOnboarded: false,
        };
      }
    }

    throw new NotFoundError('User profile not found.');
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('New password must be at least 6 characters long.');
    }

    // Update in Supabase if configured
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) {
        throw new AppError(`Password update failed: ${error.message}`, 400);
      }
    } else {
      // Update in MongoDB
      const pwdHash = hashPassword(newPassword);
      await this.mongoUserRepo.updatePasswordHash(userId, pwdHash);
    }
  }
}

export const authService = new AuthService();
export default authService;
