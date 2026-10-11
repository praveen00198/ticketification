import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  isProduction: boolean;
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseBucket: string;
  // Database (direct PostgreSQL connection for Drizzle)
  databaseUrl: string;
  // MongoDB Connection URI for Target Architecture
  mongoUri: string;
  // JWT signing secret
  jwtSecret: string;
  // Local Auth Enabled flag
  enableLocalAuth: boolean;
  // Application
  appUrl: string;
  uploadDir: string;
  puppeteerHeadless: boolean;
  initialAdminEmails: string[];
}

function validateAndLoadEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '';

  const databaseUrl = process.env.DATABASE_URL || '';
  const mongoUri = process.env.MONGODB_URI || '';
  const rawJwtSecret = process.env.JWT_SECRET || '';
  const jwtSecret = isProduction ? rawJwtSecret : (rawJwtSecret || 'Ticketification_Default_Secret_2026');

  // Local authentication is enabled by default in development/test or if Supabase is unconfigured,
  // but in production it requires explicit opt-in via ENABLE_LOCAL_AUTH=true.
  const enableLocalAuth =
    process.env.ENABLE_LOCAL_AUTH === 'true' ||
    (!isProduction && process.env.ENABLE_LOCAL_AUTH !== 'false') ||
    (!supabaseUrl && !supabaseServiceRoleKey);

  if (isProduction) {
    const missing: string[] = [];
    if (!mongoUri) {
      missing.push('MONGODB_URI (mandatory application database connection)');
    }
    if (!jwtSecret || jwtSecret === 'Ticketification_Default_Secret_2026' || jwtSecret.length < 32) {
      missing.push('JWT_SECRET (secure production secret with at least 32 characters required)');
    }
    if (!databaseUrl) {
      console.warn('ℹ️ [Env] DATABASE_URL is not set. PostgreSQL/Drizzle features will operate in standby mode.');
    }
    if (!supabaseUrl) {
      console.warn('⚠️ [Env] SUPABASE_URL is missing in production environment. Storage features will run in standby mode.');
    }
    if (!supabaseServiceRoleKey) {
      console.warn('⚠️ [Env] SUPABASE_SERVICE_ROLE_KEY is missing in production environment.');
    }
    if (missing.length > 0) {
      throw new Error(
        `[Configuration Error] Critical production environment configuration is missing:\n- ${missing.join('\n- ')}`
      );
    }
  }

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '5000', 10),
    isProduction,
    // Supabase
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || 'ticket-images',
    // Database
    databaseUrl,
    mongoUri,
    // JWT
    jwtSecret,
    enableLocalAuth,
    // Application
    appUrl: process.env.APP_URL || 'http://localhost:5173',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
    initialAdminEmails: (process.env.INITIAL_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  };
}

export const config = {
  env: validateAndLoadEnv(),
};

export default config;
