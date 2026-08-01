import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { AuthService, SignUpParams } from '../services/auth.service';

// Mocked at the same boundary as auth.service.test.ts (the Supabase client
// itself), just one layer up: here we mock the `AuthService` instance the
// query layer depends on, so these tests exercise the actual TanStack Query
// machinery (QueryClient) around it without touching Supabase or env config.
vi.mock('../services/auth.service.instance', () => ({
  getAuthService: vi.fn(),
}));

import { getAuthService } from '../services/auth.service.instance';
import { authKeys, sessionQueryOptions, signUpMutationOptions } from './auth.queries';

describe('auth.queries', () => {
  it('sessionQueryOptions fetches through auth.service and caches under authKeys.session()', async () => {
    const fakeSession = { access_token: 'token' } as unknown as Session;
    vi.mocked(getAuthService).mockReturnValue({
      getCurrentSession: vi.fn().mockResolvedValue(fakeSession),
    } as unknown as AuthService);

    const queryClient = new QueryClient();
    const result = await queryClient.fetchQuery(sessionQueryOptions());

    expect(result).toBe(fakeSession);
    expect(queryClient.getQueryData(authKeys.session())).toBe(fakeSession);
  });

  it('signUpMutationOptions wraps auth.service.signUp without adding its own logic', async () => {
    const signUp = vi.fn().mockResolvedValue({ user: null, requiresEmailConfirmation: true });
    vi.mocked(getAuthService).mockReturnValue({ signUp } as unknown as AuthService);

    const params: SignUpParams = { email: 'owner@example.com', password: 'correct-horse-1', captchaToken: 'token' };
    const mutationFn = signUpMutationOptions().mutationFn;
    await mutationFn?.(params, { client: new QueryClient(), meta: undefined });

    expect(signUp).toHaveBeenCalledWith(params);
  });
});
