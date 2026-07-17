import { useAuthSessionSync } from '../../hooks/useAuthSession';

/** Side-effect-only component: mount once near the app root to keep the auth session query in sync with Supabase's own auth state changes. */
export function AuthSessionSync() {
  useAuthSessionSync();
  return null;
}
