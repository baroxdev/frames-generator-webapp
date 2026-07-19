import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { AuthConfirmPage } from './AuthConfirmPage';

const { mockUseAuthSession } = vi.hoisted(() => ({ mockUseAuthSession: vi.fn() }));

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

describe('AuthConfirmPage', () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
  });

  it('shows a loading state while the session is being resolved', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: true, error: null });
    await renderWithProviders(<AuthConfirmPage />);

    expect(screen.getByText('Đang xác minh...')).toBeTruthy();
  });

  it('shows a failure message and a link back to login when no session was established', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    await renderWithProviders(<AuthConfirmPage />);

    expect(screen.getByText(/Liên kết xác minh không hợp lệ/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đến trang đăng nhập' })).toBeTruthy();
  });

  it('shows a success message and a continue link once the session is established', () => {
    mockUseAuthSession.mockReturnValue({
      session: { access_token: 'token' },
      user: { id: 'user-1' },
      isLoading: false,
      error: null,
    });
    await renderWithProviders(<AuthConfirmPage />);

    expect(screen.getByText(/Tài khoản của bạn đã được xác minh/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tiếp tục' })).toBeTruthy();
  });
});
