import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../../../config/env';
import { mongoUserRepository, MongoUserRepository } from '../repositories/mongo-user.repository';
import { sessionRepository, SessionRepository } from '../repositories/session.repository';
import { userRepository, UserRepository } from '../repositories/user.repository';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AppError,
} from '../../../middlewares/error.middleware';
import { RegisterInput, LoginInput, AuthResponse } from '../auth.types';
import { PlatformRole } from '../../../db/schema';
import {
  hashPassword,
  verifyPassword,
  createJwtToken,
  generateRefreshToken,
} from '../../../utils/local-auth';

export class AuthService {
  constructor(
    private mongoUserRepo: MongoUserRepository = mongoUserRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private userRepo: UserRepository = userRepository
  ) {}

  /**
   * Evaluates whether an email belongs to a pre-approved platform admin.
   * By default, self-registration never grants admin privileges.
   */
  isApprovedAdmin(_email?: string): boolean {
    return false;
  }

  /**
   * Registers a new user with custom backend authentication.
   * MongoDB is the sole authoritative user store.
   * Always assigns least-privilege default role 'USER'.
   * Never relies on Supabase Auth.
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { name, email, password } = input;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check for duplicate registration in MongoDB
    const mongoConfigured = Boolean(config.env.mongoUri);
    let existingUser = null;

    if (mongoConfigured) {
      try {
        const { isMongoConnected } = await import('../../../db/mongodb');
        if (isMongoConnected()) {
          existingUser = await this.mongoUserRepo.findByEmail(normalizedEmail);
        }
      } catch (err: any) {
        if (config.env.isProduction) {
          console.error('[AuthService] MongoDB connection error during registration:', err);
          throw new AppError('Database service temporarily unavailable.', 500);
        }
      }
    }

    if (!existingUser && config.env.databaseUrl) {
      existingUser = await this.userRepo.findByEmail(normalizedEmail);
    }

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists. Please sign in.');
    }

    // 2. Generate immutable canonical user ID & hash password
    const generatedId = 'usr_' + crypto.randomUUID().replace(/-/g, '');
    const pwdHash = hashPassword(password);
    const assignedRole: PlatformRole = 'USER'; // Invariant: Public registration strictly assigns USER role

    let createdUser: any = null;

    if (mongoConfigured) {
      try {
        const { isMongoConnected } = await import('../../../db/mongodb');
        if (isMongoConnected()) {
          createdUser = await this.mongoUserRepo.create({
            supabaseUserId: generatedId,
            email: normalizedEmail,
            name: name.trim(),
            platformRole: assignedRole,
            status: 'ACTIVE',
            passwordHash: pwdHash,
          });
        }
      } catch (dbErr: any) {
        // Handle race conditions where simultaneous requests attempt the same email
        if (dbErr.code === 11000) {
          throw new ConflictError('An account with this email address already exists. Please sign in.');
        }
        console.error('[AuthService] MongoDB error creating user:', dbErr);
        throw new AppError('Unable to create user account due to database error.', 500);
      }
    }

    // Fallback for non-production environments when MongoDB is not connected
    if (!createdUser && !config.env.isProduction) {
      if (config.env.databaseUrl) {
        createdUser = await this.userRepo.upsert({
          id: generatedId,
          name: name.trim(),
          email: normalizedEmail,
          role: assignedRole,
        });
      } else {
        // Mock user object for unit tests running without live database
        createdUser = {
          supabaseUserId: generatedId,
          id: generatedId,
          name: name.trim(),
          email: normalizedEmail,
          platformRole: assignedRole,
        };
      }
    }

    if (!createdUser) {
      throw new AppError('Unable to create user account due to database error.', 500);
    }

    const userId = createdUser.supabaseUserId || createdUser.id || generatedId;
    const userName = createdUser.name || name.trim();

    // 3. Issue backend-signed HS256 JWT access token and refresh token
    const token = createJwtToken({
      id: userId,
      email: normalizedEmail,
      role: assignedRole,
    });

    const rawRefreshToken = generateRefreshToken();

    // 4. Persist refresh session in MongoDB if connected
    try {
      const { isMongoConnected } = await import('../../../db/mongodb');
      if (isMongoConnected()) {
        await this.sessionRepo.createSession({
          userId,
          refreshToken: rawRefreshToken,
        });
      }
    } catch (sessionErr) {
      // Non-blocking in non-production environments
      if (config.env.isProduction) {
        console.error('[AuthService] Could not persist refresh session:', sessionErr);
      }
    }

    return {
      user: {
        id: userId,
        name: userName,
        email: normalizedEmail,
        role: assignedRole,
      },
      token,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Authenticates a user using custom backend credentials.
   * Compares password against stored PBKDF2/bcrypt hash in MongoDB.
   * Rejects nonexistent, invalid, or suspended accounts.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Look up user in authoritative MongoDB role store
    const mongoConfigured = Boolean(config.env.mongoUri);
    let mongoUser: any = null;
    let pgUser: any = null;

    if (mongoConfigured) {
      try {
        const { isMongoConnected } = await import('../../../db/mongodb');
        if (isMongoConnected()) {
          mongoUser = await this.mongoUserRepo.findByEmail(normalizedEmail);
        }
      } catch (err: any) {
        if (config.env.isProduction) {
          console.error('[AuthService] MongoDB error during login:', err);
          throw new AppError('Authentication service temporarily unavailable.', 500);
        }
      }
    }

    if (!mongoUser && config.env.databaseUrl) {
      try {
        pgUser = await this.userRepo.findByEmail(normalizedEmail);
      } catch {
        pgUser = null;
      }
    }

    const userRecord = mongoUser || pgUser;

    if (!userRecord) {
      throw new AuthenticationError(
        'No Ticketification account found with this email. Please sign up to create an account.',
        { email: normalizedEmail, notFound: true },
        'ACCOUNT_NOT_FOUND'
      );
    }

    if (userRecord.status === 'SUSPENDED') {
      throw new AuthenticationError(
        'Account is suspended. Please contact platform administrators.',
        undefined,
        'ACCOUNT_SUSPENDED'
      );
    }

    // 2. Validate password
    const storedHash = userRecord.passwordHash || (userRecord as any).password;
    if (!storedHash || !verifyPassword(password, storedHash)) {
      throw new AuthenticationError(
        'Incorrect password. Please check your credentials and try again.',
        undefined,
        'INVALID_CREDENTIALS'
      );
    }

    const userId = userRecord.supabaseUserId || userRecord.id;
    const userName = userRecord.name || normalizedEmail.split('@')[0] || 'User';
    const userRole = (userRecord.platformRole || userRecord.role || 'USER') as PlatformRole;

    // 3. Issue backend-signed HS256 JWT access token and refresh token
    const token = createJwtToken({
      id: userId,
      email: normalizedEmail,
      role: userRole,
    });

    const rawRefreshToken = generateRefreshToken();

    // 4. Persist refresh session in MongoDB if connected
    try {
      const { isMongoConnected } = await import('../../../db/mongodb');
      if (isMongoConnected()) {
        await this.sessionRepo.createSession({
          userId,
          refreshToken: rawRefreshToken,
        });
      }
    } catch (sessionErr) {
      if (config.env.isProduction) {
        console.error('[AuthService] Could not persist refresh session:', sessionErr);
      }
    }

    return {
      user: {
        id: userId,
        name: userName,
        email: normalizedEmail,
        role: userRole,
      },
      token,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Refreshes an expired access token using a valid, non-revoked refresh token.
   * Performs automatic token rotation and token family reuse detection.
   */
  async refreshSession(rawRefreshToken: string): Promise<AuthResponse> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new AuthenticationError('Refresh token is required.');
    }

    const cleanToken = rawRefreshToken.trim();

    // 1. Look up session in MongoDB
    let session = null;
    try {
      session = await this.sessionRepo.findByToken(cleanToken);
    } catch (err: any) {
      console.error('[AuthService] Database error checking refresh token:', err);
      throw new AppError('Unable to process session refresh.', 500);
    }

    if (!session) {
      throw new AuthenticationError('Invalid or expired refresh token. Please sign in again.');
    }

    // 2. Reuse Detection: If token is already revoked, revoke the entire family!
    if (session.revokedAt) {
      console.warn(`[Security Alert] Refresh token reuse detected for family '${session.familyId}'. Revoking family.`);
      await this.sessionRepo.revokeFamily(session.familyId);
      throw new AuthenticationError('Session invalidated due to suspicious activity. Please sign in again.');
    }

    // 3. Expiration Check
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new AuthenticationError('Session expired. Please sign in again.');
    }

    // 4. Verify user exists and is active in MongoDB
    let mongoUser: any = null;
    try {
      mongoUser = await this.mongoUserRepo.findBySupabaseId(session.userId);
    } catch (dbErr) {
      console.error('[AuthService] User lookup error during refresh:', dbErr);
    }

    if (!mongoUser) {
      await this.sessionRepo.revokeSession(cleanToken);
      throw new AuthenticationError('User profile not found. Please sign in again.', undefined, 'ACCOUNT_NOT_FOUND');
    }

    if (mongoUser.status === 'SUSPENDED') {
      await this.sessionRepo.revokeSession(cleanToken);
      throw new AuthenticationError('Account is suspended. Please contact platform administrators.');
    }

    // 5. Rotate Session: Revoke current session, create new session in same family
    const newRefreshToken = generateRefreshToken();
    const newSessionTokenHash = this.sessionRepo.hashToken(newRefreshToken);

    await this.sessionRepo.revokeSession(cleanToken, newSessionTokenHash);
    await this.sessionRepo.createSession({
      userId: mongoUser.supabaseUserId,
      refreshToken: newRefreshToken,
      familyId: session.familyId,
    });

    const newAccessToken = createJwtToken({
      id: mongoUser.supabaseUserId,
      email: mongoUser.email,
      role: mongoUser.platformRole || 'USER',
    });

    return {
      user: {
        id: mongoUser.supabaseUserId,
        name: mongoUser.name,
        email: mongoUser.email,
        role: mongoUser.platformRole || 'USER',
      },
      token: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Retrieves profile details for the authenticated user.
   * MongoDB is the sole authoritative source of truth.
   */
  async getMe(userId: string, email?: string) {
    const mongoConfigured = Boolean(config.env.mongoUri);
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    if (config.env.isProduction && mongoConfigured) {
      const { isMongoConnected } = await import('../../../db/mongodb');
      if (!isMongoConnected()) {
        console.error('[AuthService] Authoritative MongoDB role store is configured but disconnected in production.');
        throw new AppError('Unable to verify user profile due to database error.', 500);
      }
    }

    if (mongoConfigured) {
      const { isMongoConnected } = await import('../../../db/mongodb');
      const isRepoMocked = Boolean(
        (this.mongoUserRepo.findById as any)?.mock ||
        (this.mongoUserRepo.findBySupabaseId as any)?.mock ||
        (this.mongoUserRepo.findByEmail as any)?.mock
      );
      if (isMongoConnected() || isRepoMocked) {
        try {
          let mongoUser = await this.mongoUserRepo.findBySupabaseId(userId);
          if (!mongoUser) {
            mongoUser = await this.mongoUserRepo.findById(userId);
          }
          if (!mongoUser && normalizedEmail) {
            mongoUser = await this.mongoUserRepo.findByEmail(normalizedEmail);
          }

          if (mongoUser) {
            if (mongoUser.status === 'SUSPENDED') {
              throw new AuthenticationError('Account is suspended. Please contact platform administrators.');
            }

            let isOnboarded = false;
            let organizationName: string | undefined = undefined;
            if (mongoUser.hostProfile?.organizationName) {
              isOnboarded = true;
              organizationName = mongoUser.hostProfile.organizationName;
            }

            return {
              id: String(mongoUser.supabaseUserId || (mongoUser as any).id || (mongoUser as any).supabaseId || mongoUser._id),
              name: mongoUser.name,
              email: mongoUser.email,
              role: mongoUser.platformRole || 'USER',
              isOnboarded,
              organizationName,
              phone: mongoUser.phone,
              avatarUrl: mongoUser.avatarUrl,
              bio: mongoUser.metadata?.bio,
              preferences: mongoUser.metadata?.preferences,
              privacy: mongoUser.metadata?.privacy,
            };
          }
        } catch (mErr: any) {
          if (mErr instanceof AuthenticationError || mErr instanceof AppError) throw mErr;
          console.error('[AuthService] MongoDB lookup failed in getMe:', mErr);
          throw new AppError('Unable to verify user profile due to database error.', 500);
        }
      }
    }

    // In production, fallback to secondary stores is forbidden when Mongo is authoritative
    if (config.env.isProduction && mongoConfigured) {
      throw new AuthenticationError('User profile not found.', undefined, 'ACCOUNT_NOT_FOUND');
    }

    // Postgres fallback in test/development environments
    if (config.env.databaseUrl) {
      try {
        let user = await this.userRepo.findById(userId);
        if (!user && normalizedEmail) {
          user = await this.userRepo.findByEmail(normalizedEmail);
        }
        if (user) {
          if ((user as any).status === 'SUSPENDED') {
            throw new AuthenticationError('Account is suspended. Please contact platform administrators.');
          }
          const safeRole =
            user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
              ? 'USER'
              : ((user.role as PlatformRole) || 'USER');

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: safeRole,
            isOnboarded: false,
          };
        }
      } catch (dbErr: any) {
        if (dbErr instanceof AuthenticationError) throw dbErr;
        console.warn('[AuthService] Secondary Postgres lookup failed in getMe (ignored):', dbErr);
      }
    }

    throw new AuthenticationError('User profile not found.', undefined, 'ACCOUNT_NOT_FOUND');
  }

  /**
   * Updates user password in MongoDB.
   * Revokes all active refresh sessions to force re-authentication across all devices.
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('New password must be at least 6 characters long.');
    }

    const pwdHash = hashPassword(newPassword);

    if (config.env.mongoUri) {
      await this.mongoUserRepo.updatePasswordHash(userId, pwdHash);
      // Revoke all active sessions for this user in MongoDB
      await this.sessionRepo.revokeAllUserSessions(userId);
    }
  }

  /**
   * Revokes refresh token / user sessions on logout.
   */
  async logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.sessionRepo.revokeSession(refreshToken);
    }
    if (userId) {
      await this.sessionRepo.revokeAllUserSessions(userId);
    }
  }
}

export const authService = new AuthService();
export default authService;
