import crypto from 'crypto';
import config from '../../../config/env';
import { mongoUserRepository, MongoUserRepository } from '../repositories/mongo-user.repository';
import { userRepository, UserRepository } from '../repositories/user.repository';
import * as mongodb from '../../../db/mongodb';
import { PlatformRole } from '../../../db/schema';
import { ValidationError, AppError } from '../../../middlewares/error.middleware';

export interface ProvisionResult {
  success: boolean;
  email: string;
  role: PlatformRole;
  action: 'CREATED' | 'UPDATED' | 'ALREADY_ADMIN';
}

/**
 * Server-controlled Administrator Bootstrap & Provisioning Service.
 * Ensures administrator privileges can only be provisioned through explicit, server-controlled workflows,
 * never by arbitrary client requests, missing profile auto-granting, or ordinary user login.
 */
export class AdminBootstrapService {
  constructor(
    private mongoRepo: MongoUserRepository = mongoUserRepository,
    private pgRepo: UserRepository = userRepository
  ) {}

  /**
   * Explicitly provisions an allowlisted email address as a platform administrator in the authoritative database.
   * Fails closed if the authoritative role store is unavailable.
   */
  async provisionAllowlistedAdmin(email: string): Promise<ProvisionResult> {
    const normalized = email.trim().toLowerCase();

    if (!config.env.initialAdminEmails.includes(normalized)) {
      throw new ValidationError(
        `Email '${normalized}' is not in the configured administrator allowlist (INITIAL_ADMIN_EMAILS).`
      );
    }

    // 1. Authoritative MongoDB Role Store
    if (mongodb.isMongoConnected()) {
      try {
        let user = await this.mongoRepo.findByEmail(normalized);

        if (!user) {
          // Explicitly pre-provision an administrator profile in the authoritative database
          const generatedId = 'usr_' + crypto.randomUUID().replace(/-/g, '');
          user = await this.mongoRepo.create({
            supabaseUserId: generatedId,
            email: normalized,
            name: normalized.split('@')[0] || 'Administrator',
            platformRole: 'ADMIN',
            status: 'ACTIVE',
          });

          return {
            success: true,
            email: normalized,
            role: 'ADMIN',
            action: 'CREATED',
          };
        }

        if (user.platformRole === 'ADMIN' || user.platformRole === 'SUPER_ADMIN') {
          return {
            success: true,
            email: normalized,
            role: user.platformRole,
            action: 'ALREADY_ADMIN',
          };
        }

        const updated = await this.mongoRepo.updateRole(user.supabaseUserId, 'ADMIN');
        if (!updated) {
          throw new AppError('Failed to update platform role in database.', 500);
        }

        return {
          success: true,
          email: normalized,
          role: 'ADMIN',
          action: 'UPDATED',
        };
      } catch (err: any) {
        if (err instanceof ValidationError || err instanceof AppError) throw err;
        console.error('[AdminBootstrapService] Database error during administrator provisioning:', err.message);
        throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
      }
    }

    // 2. Secondary PostgreSQL Role Store Fallback
    if (config.env.databaseUrl) {
      try {
        let dbUser = await this.pgRepo.findByEmail(normalized);

        if (!dbUser) {
          const generatedId = crypto.randomUUID();
          dbUser = await this.pgRepo.upsert({
            id: generatedId,
            email: normalized,
            name: normalized.split('@')[0] || 'Administrator',
            role: 'ADMIN',
          });

          return {
            success: true,
            email: normalized,
            role: 'ADMIN',
            action: 'CREATED',
          };
        }

        if (dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN') {
          return {
            success: true,
            email: normalized,
            role: dbUser.role as PlatformRole,
            action: 'ALREADY_ADMIN',
          };
        }

        const updated = await this.pgRepo.updateRole(dbUser.id, 'ADMIN');
        if (!updated) {
          throw new AppError('Failed to update platform role in database.', 500);
        }

        return {
          success: true,
          email: normalized,
          role: 'ADMIN',
          action: 'UPDATED',
        };
      } catch (err: any) {
        if (err instanceof ValidationError || err instanceof AppError) throw err;
        console.error('[AdminBootstrapService] Database error during administrator provisioning:', err.message);
        throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
      }
    }

    // Fails closed if no database connection is available
    throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
  }

  /**
   * Bootstraps all configured allowlisted administrators at server startup.
   * Fails closed if database error occurs.
   */
  async bootstrapAllAllowlistedAdmins(): Promise<ProvisionResult[]> {
    const results: ProvisionResult[] = [];
    const emails = config.env.initialAdminEmails;

    if (emails.length === 0) {
      return results;
    }

    console.log(`[AdminBootstrap] Executing controlled administrator provisioning for ${emails.length} allowlisted email(s)...`);

    for (const email of emails) {
      const res = await this.provisionAllowlistedAdmin(email);
      results.push(res);
      console.log(`[AdminBootstrap] Provisioned '${email}' => role: ${res.role} (${res.action})`);
    }

    return results;
  }
}

export const adminBootstrapService = new AdminBootstrapService();
export default adminBootstrapService;
