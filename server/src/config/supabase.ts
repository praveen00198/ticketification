import { createClient } from '@supabase/supabase-js';
import config from './env';

/**
 * Supabase Admin Client (server-side only).
 * Uses the service_role key — NEVER expose this to the frontend.
 * Used for: Auth admin operations, Storage uploads, bypassing RLS when needed.
 */
export const supabaseAdmin =
  config.env.supabaseUrl && (config.env.supabaseServiceRoleKey || config.env.supabaseAnonKey)
    ? createClient(config.env.supabaseUrl, config.env.supabaseServiceRoleKey || config.env.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
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
