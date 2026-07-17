import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthServiceError, createAuthService } from './auth.service';

// Builds a fake Supabase client exposing only the `auth.*` methods the
// service touches. Each test overrides just the method(s) it cares about.
function createMockSupabaseClient(overrides: Partial<SupabaseClient['auth']> = {}) {
  const auth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    ...overrides,
  };
  return { auth } as unknown as SupabaseClient;
}

describe('auth.service', () => {
  describe('signUp', () => {
    it('creates an account and reports that email confirmation is required', async () => {
      const client = createMockSupabaseClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' }, session: null },
          error: null,
        }),
      });
      const authService = createAuthService(client);

      const result = await authService.signUp({
        email: 'owner@example.com',
        password: 'correct-horse-1',
        captchaToken: 'captcha-token',
      });

      expect(result.requiresEmailConfirmation).toBe(true);
      expect(result.user?.id).toBe('user-1');
      expect(client.auth.signUp).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'correct-horse-1',
        options: { captchaToken: 'captcha-token', emailRedirectTo: undefined },
      });
    });

    it('passes emailRedirectTo through when provided', async () => {
      const client = createMockSupabaseClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' }, session: null },
          error: null,
        }),
      });
      const authService = createAuthService(client);

      await authService.signUp({
        email: 'owner@example.com',
        password: 'correct-horse-1',
        captchaToken: 'captcha-token',
        emailRedirectTo: 'https://app.example.com/auth/confirm',
      });

      expect(client.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: { captchaToken: 'captcha-token', emailRedirectTo: 'https://app.example.com/auth/confirm' },
        }),
      );
    });

    it('throws a friendly AuthServiceError when the email is already registered', async () => {
      const client = createMockSupabaseClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'User already registered', status: 400 },
        }),
      });
      const authService = createAuthService(client);

      await expect(
        authService.signUp({ email: 'owner@example.com', password: 'correct-horse-1', captchaToken: 'token' }),
      ).rejects.toBeInstanceOf(AuthServiceError);
      await expect(
        authService.signUp({ email: 'owner@example.com', password: 'correct-horse-1', captchaToken: 'token' }),
      ).rejects.toThrow(/đã được đăng ký/);
    });

    it('throws a friendly AuthServiceError when the CAPTCHA challenge fails', async () => {
      const client = createMockSupabaseClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'captcha verification process failed', status: 400 },
        }),
      });
      const authService = createAuthService(client);

      await expect(
        authService.signUp({ email: 'owner@example.com', password: 'correct-horse-1', captchaToken: 'bad-token' }),
      ).rejects.toThrow(/CAPTCHA/);
    });
  });

  describe('logIn', () => {
    it('returns the user and session on success', async () => {
      const client = createMockSupabaseClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
          error: null,
        }),
      });
      const authService = createAuthService(client);

      const result = await authService.logIn({ email: 'owner@example.com', password: 'correct-horse-1' });

      expect(result.user.id).toBe('user-1');
      expect(result.session.access_token).toBe('token');
    });

    it('throws a friendly AuthServiceError on invalid credentials', async () => {
      const client = createMockSupabaseClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials', status: 400 },
        }),
      });
      const authService = createAuthService(client);

      await expect(authService.logIn({ email: 'owner@example.com', password: 'wrong' })).rejects.toThrow(
        /Email hoặc mật khẩu không đúng/,
      );
    });
  });

  describe('logOut', () => {
    it('resolves when Supabase signs the user out', async () => {
      const client = createMockSupabaseClient({ signOut: vi.fn().mockResolvedValue({ error: null }) });
      const authService = createAuthService(client);

      await expect(authService.logOut()).resolves.toBeUndefined();
      expect(client.auth.signOut).toHaveBeenCalledOnce();
    });

    it('throws a friendly AuthServiceError when sign-out fails', async () => {
      const client = createMockSupabaseClient({
        signOut: vi.fn().mockResolvedValue({ error: { message: 'network error', status: 500 } }),
      });
      const authService = createAuthService(client);

      await expect(authService.logOut()).rejects.toBeInstanceOf(AuthServiceError);
    });
  });

  describe('requestPasswordReset', () => {
    it('calls Supabase with the redirect URL', async () => {
      const client = createMockSupabaseClient({
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      });
      const authService = createAuthService(client);

      await authService.requestPasswordReset({
        email: 'owner@example.com',
        redirectTo: 'https://app.example.com/reset-password',
      });

      expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', {
        redirectTo: 'https://app.example.com/reset-password',
      });
    });

    it('throws a friendly AuthServiceError on failure', async () => {
      const client = createMockSupabaseClient({
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: null, error: { message: 'rate limited', status: 429 } }),
      });
      const authService = createAuthService(client);

      await expect(
        authService.requestPasswordReset({ email: 'owner@example.com', redirectTo: 'https://app.example.com' }),
      ).rejects.toBeInstanceOf(AuthServiceError);
    });
  });

  describe('updatePassword', () => {
    it('resolves when Supabase updates the password', async () => {
      const client = createMockSupabaseClient({
        updateUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      });
      const authService = createAuthService(client);

      await expect(authService.updatePassword({ newPassword: 'new-correct-horse-1' })).resolves.toBeUndefined();
      expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-correct-horse-1' });
    });

    it('throws a friendly AuthServiceError on failure', async () => {
      const client = createMockSupabaseClient({
        updateUser: vi.fn().mockResolvedValue({ data: null, error: { message: 'Auth session missing', status: 401 } }),
      });
      const authService = createAuthService(client);

      await expect(authService.updatePassword({ newPassword: 'new-correct-horse-1' })).rejects.toBeInstanceOf(
        AuthServiceError,
      );
    });
  });

  describe('getCurrentSession', () => {
    it('returns the current session when one exists', async () => {
      const client = createMockSupabaseClient({
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
      });
      const authService = createAuthService(client);

      const session = await authService.getCurrentSession();

      expect(session?.access_token).toBe('token');
    });

    it('returns null when there is no session', async () => {
      const client = createMockSupabaseClient({
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      });
      const authService = createAuthService(client);

      await expect(authService.getCurrentSession()).resolves.toBeNull();
    });
  });
});
