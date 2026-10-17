import config from '../../../config/env';
import { mongoUserRepository, MongoUserRepository } from '../repositories/mongo-user.repository';
import { userRepository, UserRepository } from '../repositories/user.repository';
import * as mongodb from '../../../db/mongodb';
import { PlatformRole } from '../../../db/schema';
import { ValidationError, AppError, NotFoundError } from '../../../middlewares/error.middleware';

export interface ProvisionResult {
  success: boolean;
  email: string;
  role: PlatformRole;
  action: 'CREATED' | 'UPDATED' | 'ALREADY_ADMIN';
}

/**
 * Server-controlled Administrator Bootstrap & Provisioning Service.
 * Ensures administrator privileges can only be provisioned through explicit, server-controlled workflows,
 * bound to verified user identities in the authoritative MongoDB role store.
 * Supabase Auth has been completely removed — MongoDB is the single source of truth.
 */
export class AdminBootstrapService {
  constructor(
    private mongoRepo: MongoUserRepository = mongoUserRepository,
    private pgRepo: UserRepository = userRepository
  ) {}

  /**
   * Explicitly provisions an allowlisted email address as a platform administrator in the authoritative database.
   * Requires an existing user account in MongoDB or an explicit verified user identifier.
   * Fails closed if the email is not in INITIAL_ADMIN_EMAILS or the authoritative role store is unavailable.
   */
  async provisionAllowlistedAdmin(email: string, verifiedUserId?: string): Promise<ProvisionResult> {
    const normalized = email.trim().toLowerCase();

    // 1. Strict allowlist validation
    if (!config.env.initialAdminEmails.includes(normalized)) {
      throw new ValidationError(
        `Email '${normalized}' is not in the configured administrator allowlist (INITIAL_ADMIN_EMAILS).`
      );
    }

    // 2. Resolve authoritative existing records first
    let existingMongoUser = null;
    let existingPgUser = null;

    if (mongodb.isMongoConnected()) {
      try {
        existingMongoUser = await this.mongoRepo.findByEmail(normalized);
      } catch (err: any) {
        console.error('[AdminBootstrapService] Database error during admin lookup:', err.message);
        throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
      }
    }

    if (config.env.databaseUrl) {
      try {
        existingPgUser = await this.pgRepo.findByEmail(normalized);
      } catch (err: any) {
        console.error('[AdminBootstrapService] Database error during admin lookup:', err.message);
        throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
      }
    }

    // 3. Resolve the user identifier
    let verifiedId: string | undefined = undefined;

    if (existingMongoUser) {
      verifiedId = existingMongoUser.supabaseUserId;
    } else if (existingPgUser) {
      verifiedId = existingPgUser.id;
    }

    if (verifiedUserId) {
      if (verifiedId && verifiedId !== verifiedUserId) {
        throw new ValidationError(
          `Identity mismatch: provided user ID '${verifiedUserId}' does not match authoritative identifier '${verifiedId}'.`
        );
      }
      verifiedId = verifiedUserId;
    }

    if (!verifiedId && !existingMongoUser && !existingPgUser) {
      throw new NotFoundError(
        `Cannot provision administrator profile: No registered account found for email '${normalized}'. User must register an account first before administrator privileges can be provisioned.`
      );
    }

    // 4. Update or create profile in authoritative MongoDB role store
    if (mongodb.isMongoConnected()) {
      try {
        if (!existingMongoUser) {
          existingMongoUser = await this.mongoRepo.create({
            supabaseUserId: verifiedId!,
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

        // Idempotent: preserve already provisioned administrator
        if (existingMongoUser.platformRole === 'ADMIN' || existingMongoUser.platformRole === 'SUPER_ADMIN') {
          return {
            success: true,
            email: normalized,
            role: existingMongoUser.platformRole,
            action: 'ALREADY_ADMIN',
          };
        }

        const updated = await this.mongoRepo.updateRole(existingMongoUser.supabaseUserId, 'ADMIN');
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
        if (err instanceof ValidationError || err instanceof AppError || err instanceof NotFoundError) throw err;
        console.error('[AdminBootstrapService] Database error during administrator provisioning:', err.message);
        throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
      }
    }

    // 5. Secondary PostgreSQL Role Store Fallback
    if (config.env.databaseUrl) {
      try {
        if (!existingPgUser) {
          existingPgUser = await this.pgRepo.upsert({
            id: verifiedId!,
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

        if (existingPgUser.role === 'ADMIN' || existingPgUser.role === 'SUPER_ADMIN') {
          return {
            success: true,
            email: normalized,
            role: existingPgUser.role as PlatformRole,
            action: 'ALREADY_ADMIN',
          };
        }

        const updated = await this.pgRepo.updateRole(existingPgUser.id, 'ADMIN');
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
        if (err instanceof ValidationError || err instanceof AppError || err instanceof NotFoundError) throw err;
        console.error('[AdminBootstrapService] Database error during administrator provisioning:', err.message);
        throw new AppError('Authoritative role store is unavailable. Administrator provisioning failed closed.', 500);
      }
    }

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
      try {
        const res = await this.provisionAllowlistedAdmin(email);
        results.push(res);
        console.log(`[AdminBootstrap] Provisioned '${email}' => role: ${res.role} (${res.action})`);
      } catch (err: any) {
        if (err instanceof NotFoundError) {
          console.log(`[AdminBootstrap] Pending registration for '${email}': Account does not exist in MongoDB yet. Will be granted ADMIN upon registration.`);
        } else {
          throw err;
        }
      }
    }

    return results;
  }
}

export const adminBootstrapService = new AdminBootstrapService();
export default adminBootstrapService;
