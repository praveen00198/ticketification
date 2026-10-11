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
  // CORS Trusted Origins
  corsOrigins: string[];
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

  // In production, local authentication is STRICTLY opt-in via ENABLE_LOCAL_AUTH=true.
  // Missing Supabase configuration NEVER implicitly enables local authentication in production.
  // In development and test environments, local auth is enabled by default unless explicitly disabled.
  const enableLocalAuth = isProduction
    ? process.env.ENABLE_LOCAL_AUTH === 'true'
    : process.env.ENABLE_LOCAL_AUTH !== 'false';

  // Parse and validate explicit trusted frontend CORS origins
  const rawCorsOrigins = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ]
    .filter(Boolean)
    .map((o) => (o as string).trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);

  const corsOrigins = Array.from(new Set(rawCorsOrigins));

  if (isProduction) {
    const missing: string[] = [];

    // 1. Mandatory Application Database
    if (!mongoUri) {
      missing.push('MONGODB_URI (mandatory application database connection)');
    }

    // 2. Strict Authentication Provider Configuration
    if (enableLocalAuth) {
      if (!jwtSecret || jwtSecret === 'Ticketification_Default_Secret_2026' || jwtSecret.length < 32) {
        missing.push('JWT_SECRET (secure production secret with at least 32 characters required when ENABLE_LOCAL_AUTH=true)');
      }
    } else {
      if (!supabaseUrl) {
        missing.push('SUPABASE_URL (required authentication provider in production when local auth is disabled)');
      }
      if (!supabaseServiceRoleKey) {
        missing.push('SUPABASE_SERVICE_ROLE_KEY (required production service role key when local auth is disabled)');
      }
    }

    // 3. Mandatory Explicit CORS Origins for Browser Frontend
    if (corsOrigins.length === 0) {
      missing.push('CORS configuration: At least one explicit trusted frontend origin must be configured via APP_URL, FRONTEND_URL, or ALLOWED_ORIGINS in production.');
    }
    if (corsOrigins.some((o) => o === '*')) {
      missing.push('CORS configuration: Wildcard origin "*" is strictly prohibited with credentialed requests in production.');
    }
    const invalidOrigins = corsOrigins.filter((o) => !/^https?:\/\//i.test(o));
    if (invalidOrigins.length > 0) {
      missing.push(`CORS configuration: Configured origins must include protocol (e.g. https://...): ${invalidOrigins.join(', ')}`);
    }

    if (!databaseUrl) {
      console.warn('ℹ️ [Env] DATABASE_URL is not set. PostgreSQL/Drizzle features will operate in standby mode.');
    }

    if (missing.length > 0) {
      throw new Error(
        `[Configuration Error] Critical production environment configuration is missing or invalid:\n- ${missing.join('\n- ')}`
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
    corsOrigins,
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
