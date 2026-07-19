import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ResetPasswordPage } from './ResetPasswordPage';

const { mockUpdatePassword, mockNavigate, mockReportAuthError, mockUseAuthSession } = vi.hoisted(() => ({
  mockUpdatePassword: vi.fn(),
  mockNavigate: vi.fn(),
  mockReportAuthError: vi.fn(),
  mockUseAuthSession: vi.fn(),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock('../../queries/auth.queries', () => ({
  updatePasswordMutationOptions: () => ({ mutationFn: mockUpdatePassword }),
}));

vi.mock('../../utils/report-auth-error', () => ({
  reportAuthError: mockReportAuthError,
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockUpdatePassword.mockReset();
    mockNavigate.mockClear();
    mockReportAuthError.mockClear();
    mockUseAuthSession.mockReset();
  });

  it('shows a loading state while the recovery session is being verified', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: true, error: null });
    await renderWithProviders(<ResetPasswordPage />);

    expect(screen.getByText('Đang xác minh liên kết...')).toBeTruthy();
  });

  it('shows an invalid-link message and no form when there is no recovery session', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    await renderWithProviders(<ResetPasswordPage />);

    expect(screen.getByText(/Liên kết đặt lại mật khẩu không hợp lệ/)).toBeTruthy();
    expect(screen.queryByLabelText('Mật khẩu mới')).toBeNull();
  });

  it('submits the new password and navigates to /account on success', async () => {
    mockUseAuthSession.mockReturnValue({
      session: { access_token: 'token' },
      user: { id: 'user-1' },
      isLoading: false,
      error: null,
    });
    mockUpdatePassword.mockResolvedValue(undefined);
    await renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'new-correct-horse-1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'new-correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

    await waitFor(() =>
      expect(mockUpdatePassword).toHaveBeenCalledWith({ newPassword: 'new-correct-horse-1' }, expect.anything()),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/account' }));
  });

  it('shows a validation error and never calls the mutation when the passwords do not match', async () => {
    mockUseAuthSession.mockReturnValue({
      session: { access_token: 'token' },
      user: { id: 'user-1' },
      isLoading: false,
      error: null,
    });
    await renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'new-correct-horse-1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'different-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

    await screen.findByText('Mật khẩu nhập lại không khớp');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('reports a friendly error when updating the password fails', async () => {
    mockUseAuthSession.mockReturnValue({
      session: { access_token: 'token' },
      user: { id: 'user-1' },
      isLoading: false,
      error: null,
    });
    const failure = new Error('Auth session missing');
    mockUpdatePassword.mockRejectedValue(failure);
    await renderWithProviders(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'new-correct-horse-1' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: 'new-correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

    await waitFor(() => expect(mockReportAuthError).toHaveBeenCalledWith(failure, 'Không thể cập nhật mật khẩu.'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
