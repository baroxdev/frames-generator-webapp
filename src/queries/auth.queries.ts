import { queryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getAuthService } from '../services/auth.service.instance';
import type {
  LogInParams,
  LogInResult,
  RequestPasswordResetParams,
  SignUpParams,
  SignUpResult,
  UpdatePasswordParams,
} from '../services/auth.service';
import type { Session } from '@supabase/supabase-js';

/**
 * Centralized, typed query keys for the auth domain. Every query/mutation
 * below (and anything elsewhere that needs to read or invalidate auth
 * state) should key off these instead of ad-hoc string-literal arrays.
 */
export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

/**
 * The current Supabase session, cached by TanStack Query. There's no
 * polling here — `useAuthSessionSync` (in `useAuthSession.ts`) keeps this
 * cache entry fresh by pushing every Supabase `onAuthStateChange` event
 * straight into the cache, so `staleTime: Infinity` is intentional: a
 * background refetch would just race that push.
 */
export function sessionQueryOptions() {
  return queryOptions({
    queryKey: authKeys.session(),
    queryFn: (): Promise<Session | null> => getAuthService().getCurrentSession(),
    staleTime: Infinity,
  });
}

// Mutation option factories below wrap `auth.service` one-for-one — they
// add no business logic of their own, only the caching/loading-state layer
// TanStack Query provides. Session-affecting outcomes (login, logout,
// password update) don't need explicit cache invalidation here: Supabase
// fires a matching `onAuthStateChange` event for each, which
// `useAuthSessionSync` already turns into a cache update.

export function signUpMutationOptions(): UseMutationOptions<SignUpResult, Error, SignUpParams> {
  return {
    mutationFn: (params) => getAuthService().signUp(params),
  };
}

export function logInMutationOptions(): UseMutationOptions<LogInResult, Error, LogInParams> {
  return {
    mutationFn: (params) => getAuthService().logIn(params),
  };
}

export function logOutMutationOptions(): UseMutationOptions<void, Error, void> {
  return {
    mutationFn: () => getAuthService().logOut(),
  };
}

export function requestPasswordResetMutationOptions(): UseMutationOptions<
  void,
  Error,
  RequestPasswordResetParams
> {
  return {
    mutationFn: (params) => getAuthService().requestPasswordReset(params),
  };
}

export function updatePasswordMutationOptions(): UseMutationOptions<void, Error, UpdatePasswordParams> {
  return {
    mutationFn: (params) => getAuthService().updatePassword(params),
  };
}
