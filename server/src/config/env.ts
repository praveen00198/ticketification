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
  // Application
  appUrl: string;
  uploadDir: string;
  puppeteerHeadless: boolean;
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

  if (isProduction) {
    if (!supabaseUrl) console.warn('⚠️ [Env] SUPABASE_URL is missing in production environment.');
    if (!supabaseServiceRoleKey) console.warn('⚠️ [Env] SUPABASE_SERVICE_ROLE_KEY is missing in production environment.');
    if (!databaseUrl) console.warn('⚠️ [Env] DATABASE_URL is missing in production environment. Database queries will fail.');
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
    // Application
    appUrl: process.env.APP_URL || 'http://localhost:5173',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
  };
}

export const config = {
  env: validateAndLoadEnv(),
};

export default config;
