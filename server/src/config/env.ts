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

  if (isProduction) {
    if (!process.env.SUPABASE_URL) console.warn('⚠️ [Env] SUPABASE_URL is missing in production environment.');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.warn('⚠️ [Env] SUPABASE_SERVICE_ROLE_KEY is missing in production environment.');
    if (!process.env.DATABASE_URL) console.warn('⚠️ [Env] DATABASE_URL is missing in production environment. Database queries will return 500 error.');
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
