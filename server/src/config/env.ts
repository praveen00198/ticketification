import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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

  if (isProduction && !process.env.SUPABASE_URL) {
    throw new Error('FATAL: SUPABASE_URL must be set in production.');
  }
  if (isProduction && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY must be set in production.');
  }
  if (isProduction && !process.env.DATABASE_URL) {
    throw new Error('FATAL: DATABASE_URL must be set in production.');
  }

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '5000', 10),
    isProduction,
    // Supabase
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseBucket: process.env.SUPABASE_BUCKET || 'ticket-images',
    // Database
    databaseUrl: process.env.DATABASE_URL || '',
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
