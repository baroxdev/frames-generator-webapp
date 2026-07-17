import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';

let cachedClient: SupabaseClient | null = null;

/**
 * Lazily creates (and memoizes) the single Supabase client the app uses for
 * Auth and, later, database/storage access. Lazy so importing this module
 * never throws just because it happens to be reachable from a code path that
 * isn't executed yet (e.g. during tests that mock the client entirely).
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const env = getEnv();
  cachedClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}
