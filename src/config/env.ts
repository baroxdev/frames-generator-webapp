import { z } from 'zod';

// All Supabase/Turnstile wiring reads from Vite env vars so no secret ever
// lives in source. See `.env.example` for the full list of variables an
// environment must provide before auth (or anything built on top of it) works.
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_TURNSTILE_SITE_KEY: z.string().min(1, 'VITE_TURNSTILE_SITE_KEY is required'),
  // Public by design — Facebook's Feed Dialog (developers.facebook.com/documentation/sharing/reference/feed-dialog)
  // takes the App ID as a plain query param in the share link itself, unlike
  // the App Secret, which never appears client-side.
  VITE_FACEBOOK_APP_ID: z.string().min(1, 'VITE_FACEBOOK_APP_ID is required'),
  // Temporary escape hatch while the Turnstile UX is being reworked (see
  // supabase/functions/submit-tribute's matching `TURNSTILE_BYPASS_ENABLED`
  // secret) — skips rendering the widget on TributeForm. Must be unset
  // (or "false") in production once Turnstile is reinstated.
  VITE_TURNSTILE_BYPASS: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
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
