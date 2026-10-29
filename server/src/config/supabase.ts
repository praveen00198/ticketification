import { createClient } from '@supabase/supabase-js';
import config from './env';

/**
 * Dedicated Supabase Storage Admin Client (server-side only).
 * Uses SUPABASE_SERVICE_ROLE_KEY exclusively for Storage operations.
 * Completely isolated from user auth sessions to guarantee service_role RLS bypass.
 * Supabase is used EXCLUSIVELY for file/object storage (ticket PNGs, PDFs, ZIP exports).
 */
export const supabaseStorageAdmin =
  config.env.supabaseUrl && config.env.supabaseServiceRoleKey
    ? createClient(config.env.supabaseUrl, config.env.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

/**
 * Supabase Admin Client for fallback user authentication token verification.
 * Initialized when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured.
 */
export const supabaseAdmin =
  config.env.supabaseUrl && config.env.supabaseServiceRoleKey
    ? createClient(config.env.supabaseUrl, config.env.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

/**
 * Supabase Public Client for client-facing/anon operations if configured.
 */
export const supabasePublic =
  config.env.supabaseUrl && config.env.supabaseAnonKey
    ? createClient(config.env.supabaseUrl, config.env.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

