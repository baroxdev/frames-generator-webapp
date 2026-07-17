import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

export type SignUpParams = {
  email: string;
  password: string;
  captchaToken: string;
  emailRedirectTo?: string;
};

export type SignUpResult = {
  user: User | null;
  requiresEmailConfirmation: boolean;
};

export type LogInParams = {
  email: string;
  password: string;
};

export type LogInResult = {
  user: User;
  session: Session;
};

export type RequestPasswordResetParams = {
  email: string;
  redirectTo: string;
};

export type UpdatePasswordParams = {
  newPassword: string;
};

export interface AuthService {
  signUp(params: SignUpParams): Promise<SignUpResult>;
  logIn(params: LogInParams): Promise<LogInResult>;
  logOut(): Promise<void>;
  requestPasswordReset(params: RequestPasswordResetParams): Promise<void>;
  updatePassword(params: UpdatePasswordParams): Promise<void>;
  getCurrentSession(): Promise<Session | null>;
}

/** Thrown by every auth.service method; `message` is always safe to show a user. */
export class AuthServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AuthServiceError';
    this.cause = options?.cause;
  }
}

type SupabaseAuthError = { message: string; status?: number };

const FALLBACK_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';

/** Maps known Supabase Auth error strings to user-friendly Vietnamese copy. */
function toFriendlyMessage(error: SupabaseAuthError, fallback: string): string {
  const raw = error.message.toLowerCase();

  if (raw.includes('captcha')) return 'Xác minh CAPTCHA thất bại. Vui lòng thử lại.';
  if (raw.includes('already registered') || raw.includes('already exists')) {
    return 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.';
  }
  if (raw.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (raw.includes('email not confirmed')) return 'Vui lòng xác minh email trước khi đăng nhập.';
  if (raw.includes('rate limit')) return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
  if (raw.includes('session missing') || raw.includes('not authenticated')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  return fallback;
}

/**
 * Thin wrapper around Supabase Auth, mirroring the existing
 * `google-sheet.ts` / storage-service pattern: callers depend on this small
 * interface instead of the Supabase SDK directly. The client is injected so
 * tests can supply a mock at the SDK boundary instead of hitting a live
 * backend.
 */
export function createAuthService(client: SupabaseClient): AuthService {
  return {
    async signUp({ email, password, captchaToken, emailRedirectTo }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { captchaToken, emailRedirectTo },
      });

      if (error) {
        throw new AuthServiceError(toFriendlyMessage(error, 'Không thể tạo tài khoản. Vui lòng thử lại.'), {
          cause: error,
        });
      }

      return { user: data.user, requiresEmailConfirmation: !data.session };
    },

    async logIn({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        throw new AuthServiceError(toFriendlyMessage(error, 'Không thể đăng nhập. Vui lòng thử lại.'), {
          cause: error,
        });
      }
      if (!data.user || !data.session) {
        throw new AuthServiceError(FALLBACK_MESSAGE);
      }

      return { user: data.user, session: data.session };
    },

    async logOut() {
      const { error } = await client.auth.signOut();
      if (error) {
        throw new AuthServiceError(toFriendlyMessage(error, 'Không thể đăng xuất. Vui lòng thử lại.'), {
          cause: error,
        });
      }
    },

    async requestPasswordReset({ email, redirectTo }) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        throw new AuthServiceError(
          toFriendlyMessage(error, 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.'),
          { cause: error },
        );
      }
    },

    async updatePassword({ newPassword }) {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        throw new AuthServiceError(toFriendlyMessage(error, 'Không thể cập nhật mật khẩu. Vui lòng thử lại.'), {
          cause: error,
        });
      }
    },

    async getCurrentSession() {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw new AuthServiceError('Không thể lấy phiên đăng nhập.', { cause: error });
      }
      return data.session;
    },
  };
}
