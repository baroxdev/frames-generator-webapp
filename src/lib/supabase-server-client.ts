import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';

/**
 * A fresh, stateless Supabase client for server-side reads (loaders/server
 * functions) — same anon key as the browser client (`supabase-client.ts`),
 * so RLS policies gate visibility exactly as they do for a client-side
 * call. Session persistence/auto-refresh/URL detection are all browser-only
 * concerns and are disabled here; a new client is created per call rather
 * than memoized as a singleton, since a server function may run concurrently
 * across unrelated requests in the same process.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const env = getEnv();
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
