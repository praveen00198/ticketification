import dns from 'dns';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import config from '../config/env';
import * as schema from './schema';

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * PostgreSQL connection via postgres.js driver.
 * Used by Drizzle ORM for all database interactions.
 */
const connectionString = config.env.databaseUrl;

let db: ReturnType<typeof drizzle<typeof schema>>;

if (connectionString) {
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for Supabase connection poolers / PgBouncer
  });
  db = drizzle(client, { schema });
} else {
  console.warn('[DB] DATABASE_URL not set. Database operations will fail.');
  // Create a placeholder that will throw meaningful errors
  db = new Proxy({} as any, {
    get: (_target, prop) => {
      if (prop === 'then' || prop === 'catch') return undefined;
      return () => {
        throw new Error('Database not configured. Set DATABASE_URL in .env');
      };
    },
  });
}

export { db };
export type Database = typeof db;
