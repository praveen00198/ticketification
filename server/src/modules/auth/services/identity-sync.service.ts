import { mongoUserRepository, MongoUserRepository } from '../repositories/mongo-user.repository';
import { isMongoConnected } from '../../../db/mongodb';
import { IUserDocument, PlatformRole } from '../../../db/mongo/models/user.model';
import { UserRepository, userRepository } from '../repositories/user.repository';

export interface SyncResult {
  total: number;
  synced: number;
  errors: number;
  details?: { email: string; status: 'synced' | 'failed'; error?: string }[];
}

export class IdentitySyncService {
  constructor(
    private mongoRepo: MongoUserRepository = mongoUserRepository,
    private pgRepo: UserRepository = userRepository
  ) {}

  /**
   * Synchronize an individual PostgreSQL user record into MongoDB.
   * Safe and non-blocking: if MongoDB is not connected, logs a warning and returns null.
   */
  async syncUserToMongo(pgUser: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    createdAt?: Date | null;
  }): Promise<IUserDocument | null> {
    if (!isMongoConnected()) {
      return null;
    }

    try {
      const validPlatformRole: PlatformRole =
        pgUser.role === 'ADMIN' || pgUser.role === 'SUPER_ADMIN' ? pgUser.role : 'USER';

      const mongoUser = await this.mongoRepo.upsert({
        supabaseUserId: pgUser.id,
        email: pgUser.email,
        name: pgUser.name || 'User',
        platformRole: validPlatformRole,
      });

      return mongoUser;
    } catch (err: any) {
      console.warn(`⚠️ [IdentitySync] Failed to sync user ${pgUser.email} to MongoDB:`, err.message);
      return null;
    }
  }

  /**
   * Reconcile/sync all PostgreSQL users into MongoDB idempotently.
   * Useful for initial migration and reconciliation jobs.
   */
  async syncAllPostgresUsersToMongo(): Promise<SyncResult> {
    if (!isMongoConnected()) {
      return { total: 0, synced: 0, errors: 0 };
    }

    const result: SyncResult = {
      total: 0,
      synced: 0,
      errors: 0,
      details: [],
    };

    try {
      const pgUsers = await this.pgRepo.findAll();
      result.total = pgUsers.length;

      for (const pgUser of pgUsers) {
        try {
          const syncedDoc = await this.syncUserToMongo(pgUser);
          if (syncedDoc) {
            result.synced += 1;
            result.details?.push({ email: pgUser.email, status: 'synced' });
          } else {
            result.errors += 1;
            result.details?.push({ email: pgUser.email, status: 'failed', error: 'Database sync returned null' });
          }
        } catch (innerErr: any) {
          result.errors += 1;
          result.details?.push({ email: pgUser.email, status: 'failed', error: innerErr.message });
        }
      }

      console.log(`[IdentitySync] Bulk sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors.`);
      return result;
    } catch (err: any) {
      console.error('[IdentitySync] Bulk sync failed:', err.message);
      return result;
    }
  }
}

export const identitySyncService = new IdentitySyncService();
export default identitySyncService;
