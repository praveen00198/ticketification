import { createClient } from '@supabase/supabase-js';
import config from './env';

/**
 * Supabase Admin Client (server-side only).
 * Uses the service_role key — NEVER expose this to the frontend.
 * Used for: Auth admin operations (createUser, getUserById, etc.).
 */
export const supabaseAdmin =
  config.env.supabaseUrl && config.env.supabaseServiceRoleKey
    ? createClient(config.env.supabaseUrl, config.env.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

/**
 * Dedicated Supabase Storage Admin Client (server-side only).
 * Uses SUPABASE_SERVICE_ROLE_KEY exclusively for Storage operations.
 * Completely isolated from user auth sessions to guarantee service_role RLS bypass.
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
 * Supabase Public Client (anon key).
 * Used for: Auth operations on behalf of users (login, register).
 */
export const supabasePublic = config.env.supabaseUrl && config.env.supabaseAnonKey
  ? createClient(config.env.supabaseUrl, config.env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

