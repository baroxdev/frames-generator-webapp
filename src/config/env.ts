import { z } from 'zod';

// All Supabase/Turnstile wiring reads from Vite env vars so no secret ever
// lives in source. See `.env.example` for the full list of variables an
// environment must provide before auth (or anything built on top of it) works.
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_TURNSTILE_SITE_KEY: z.string().min(1, 'VITE_TURNSTILE_SITE_KEY is required'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates and returns the app's runtime environment configuration.
 * Throws a descriptive error at first use (fail fast) rather than letting a
 * missing variable surface later as a confusing Supabase SDK error.
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(import.meta.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(
      `Missing or invalid environment configuration:\n${missing}\n\nCopy .env.example to .env and fill in the values from your Supabase project settings.`,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}
