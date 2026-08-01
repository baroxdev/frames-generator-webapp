import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authKeys, sessionQueryOptions } from '../queries/auth.queries';
import { getSupabaseClient } from '../lib/supabase-client';
import { identifyUser, resetUser } from '../lib/analytics';

type AuthSessionState = {
  session: Session | null;
  user: Session['user'] | null;
  isLoading: boolean;
  /** Set when the session query failed — most commonly a missing/invalid env var, surfaced here instead of thrown so the page can render a friendly notice. */
  error: Error | null;
};

/**
 * Reads the current auth session from the TanStack Query cache. This is the
 * single source of truth for "am I logged in" across the app — no parallel
 * component state — kept fresh by `useAuthSessionSync` below.
 */
export function useAuthSession(): AuthSessionState {
  const query = useQuery(sessionQueryOptions());

  return {
    session: query.data ?? null,
    user: query.data?.user ?? null,
    isLoading: query.isPending,
    error: query.error,
  };
}

/**
 * Mount once near the app root. Subscribes to Supabase's own
 * `onAuthStateChange` and pushes every event straight into the query cache,
 * so `useAuthSession` (and anything else reading `authKeys.session()`)
 * updates immediately on sign-in, sign-out, token refresh, or password
 * recovery — without polling or manual invalidation calls scattered through
 * mutation callbacks.
 */
export function useAuthSessionSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let client;
    try {
      client = getSupabaseClient();
    } catch {
      // Missing/invalid config; the session query itself will surface this
      // via its own error state, so there's nothing to subscribe to here.
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(authKeys.session(), session);
      if (session?.user) {
        identifyUser(session.user.id, { email: session.user.email });
      } else {
        resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);
}
