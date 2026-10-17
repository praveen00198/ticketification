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
 * @deprecated Supabase Auth has been completely removed from Ticketification.
 * Maintained as null strictly for backwards compatibility with legacy test mocks.
 */
export const supabaseAdmin = null;

/**
 * @deprecated Supabase Auth has been completely removed from Ticketification.
 * Maintained as null strictly for backwards compatibility with legacy test mocks.
 */
export const supabasePublic = null;
