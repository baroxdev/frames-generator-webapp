import { fireEvent, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { SignUpPage } from './SignUpPage';

const { mockReset, mockSignUp, mockReportAuthError } = vi.hoisted(() => ({
  mockReset: vi.fn(),
  mockSignUp: vi.fn(),
  mockReportAuthError: vi.fn(),
}));

// The real widget loads Cloudflare's script and needs a live site key; the
// mock stands in a button that immediately "verifies", and exposes the same
// imperative reset() handle so the captcha-reset-on-failure behavior below
// can be asserted without any of that.
vi.mock('../../components/auth/TurnstileWidget', () => ({
  TurnstileWidget: forwardRef(function MockTurnstileWidget(
    props: { onVerify: (token: string) => void },
    ref: Ref<{ reset: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({ reset: mockReset }));
    return (
      <button type="button" onClick={() => props.onVerify('test-captcha-token')}>
        mock-verify-captcha
      </button>
    );
  }),
}));

vi.mock('../../config/useEnv', () => ({
  useEnv: () => ({
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      VITE_TURNSTILE_SITE_KEY: 'test-site-key',
    },
    error: null,
  }),
}));

vi.mock('../../queries/auth.queries', () => ({
  signUpMutationOptions: () => ({ mutationFn: mockSignUp }),
}));

vi.mock('../../utils/report-auth-error', () => ({
  reportAuthError: mockReportAuthError,
}));

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'correct-horse-1' } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'correct-horse-1' } });
  fireEvent.click(screen.getByText('mock-verify-captcha'));
}

describe('SignUpPage', () => {
  beforeEach(() => {
    mockReset.mockClear();
    mockSignUp.mockReset();
    mockReportAuthError.mockClear();
  });

  it('submits the mutation with the validated fields and captcha token, then shows the confirmation screen', async () => {
    mockSignUp.mockResolvedValue({ user: { id: 'user-1' }, requiresEmailConfirmation: true });
    await renderWithProviders(<SignUpPage />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'owner@example.com',
          password: 'correct-horse-1',
          captchaToken: 'test-captcha-token',
        }),
        expect.anything(),
      ),
    );
    await screen.findByText(/Kiểm tra email của bạn/);
  });

  it('shows a validation error and never calls the mutation when passwords do not match', async () => {
    await renderWithProviders(<SignUpPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'different-1' } });
    fireEvent.click(screen.getByText('mock-verify-captcha'));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await screen.findByText('Mật khẩu nhập lại không khớp');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('resets the captcha and reports a friendly error when signup fails (e.g. duplicate email)', async () => {
    const failure = new Error('User already registered');
    mockSignUp.mockRejectedValue(failure);
    await renderWithProviders(<SignUpPage />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => expect(mockReportAuthError).toHaveBeenCalledWith(failure, 'Không thể tạo tài khoản. Vui lòng thử lại.'));
    // The single-use Turnstile token must be invalidated so a retry gets a fresh one.
    expect(mockReset).toHaveBeenCalledTimes(1);
    // Still on the form, not the "check your email" confirmation screen.
    expect(screen.queryByText(/Kiểm tra email của bạn/)).toBeNull();
  });
});
