import { connectMongoDB, disconnectMongoDB } from '../db/mongodb';
import { identitySyncService } from '../modules/auth/services/identity-sync.service';

/**
 * CLI Script: Sync all PostgreSQL users to MongoDB application identity.
 * Run via: npx ts-node src/scripts/syncUsersToMongo.ts
 */
async function run() {
  console.log('[Script] Starting PostgreSQL -> MongoDB User Identity Sync...');
  const conn = await connectMongoDB();

  if (!conn) {
    console.error('[Script] Could not connect to MongoDB. Ensure MONGODB_URI is set.');
    process.exit(1);
  }

  try {
    const result = await identitySyncService.syncAllPostgresUsersToMongo();
    console.log(`[Script] Finished. Total: ${result.total}, Synced: ${result.synced}, Errors: ${result.errors}`);
  } catch (err: any) {
    console.error('[Script] Sync error:', err.message);
  } finally {
    await disconnectMongoDB();
  }
}

if (require.main === module) {
  run().catch(console.error);
}
