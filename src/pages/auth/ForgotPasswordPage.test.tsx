import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ForgotPasswordPage } from './ForgotPasswordPage';

const { mockRequestPasswordReset, mockReportAuthError } = vi.hoisted(() => ({
  mockRequestPasswordReset: vi.fn(),
  mockReportAuthError: vi.fn(),
}));

vi.mock('../../queries/auth.queries', () => ({
  requestPasswordResetMutationOptions: () => ({ mutationFn: mockRequestPasswordReset }),
}));

vi.mock('../../utils/report-auth-error', () => ({
  reportAuthError: mockReportAuthError,
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
    mockReportAuthError.mockClear();
  });

  it('submits the mutation with the email and a reset redirect URL, then shows the confirmation screen', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    await renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }));

    await waitFor(() =>
      expect(mockRequestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'owner@example.com' }),
        expect.anything(),
      ),
    );
    await screen.findByText(/Kiểm tra email của bạn/);
  });

  it('shows a validation error and never calls the mutation for an invalid email', async () => {
    await renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }));

    await screen.findByText('Email không hợp lệ');
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('reports a friendly error when the request fails', async () => {
    const failure = new Error('rate limited');
    mockRequestPasswordReset.mockRejectedValue(failure);
    await renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại mật khẩu' }));

    await waitFor(() =>
      expect(mockReportAuthError).toHaveBeenCalledWith(failure, 'Không thể gửi email đặt lại mật khẩu.'),
    );
    expect(screen.queryByText(/Kiểm tra email của bạn/)).toBeNull();
  });
});
