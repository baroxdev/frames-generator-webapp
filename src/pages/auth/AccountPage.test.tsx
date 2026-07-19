import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { AccountPage } from './AccountPage';

const { mockLogOut, mockNavigate, mockReportAuthError, mockUseAuthSession } = vi.hoisted(() => ({
  mockLogOut: vi.fn(),
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
  logOutMutationOptions: () => ({ mutationFn: mockLogOut }),
}));

vi.mock('../../utils/report-auth-error', () => ({
  reportAuthError: mockReportAuthError,
}));

describe('AccountPage', () => {
  beforeEach(() => {
    mockLogOut.mockReset();
    mockNavigate.mockClear();
    mockReportAuthError.mockClear();
    mockUseAuthSession.mockReset();
  });

  it('shows a loading state while the session resolves', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: true, error: null });
    await renderWithProviders(<AccountPage />);

    expect(screen.getByText('Đang tải...')).toBeTruthy();
  });

  it('redirects to /login when there is no session', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    // <Navigate> resolves against the real router (only this test's own
    // `useNavigate()` call inside AccountPage is mocked above), so routing
    // it to a real /login route lets us assert on the outcome directly.
    await renderWithProviders(<AccountPage />, {
      route: '/account',
      additionalRoutes: [{ path: '/login', element: <div>login-page-placeholder</div> }],
    });

    expect(screen.getByText('login-page-placeholder')).toBeTruthy();
  });

  it('shows the signed-in email and logs out on click', async () => {
    mockUseAuthSession.mockReturnValue({
      session: { access_token: 'token' },
      user: { id: 'user-1', email: 'owner@example.com' },
      isLoading: false,
      error: null,
    });
    mockLogOut.mockResolvedValue(undefined);
    await renderWithProviders(<AccountPage />);

    expect(screen.getByText(/owner@example.com/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(mockLogOut).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' }));
  });

  it('reports a friendly error when logout fails', async () => {
    mockUseAuthSession.mockReturnValue({
      session: { access_token: 'token' },
      user: { id: 'user-1', email: 'owner@example.com' },
      isLoading: false,
      error: null,
    });
    const failure = new Error('network error');
    mockLogOut.mockRejectedValue(failure);
    await renderWithProviders(<AccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(mockReportAuthError).toHaveBeenCalledWith(failure, 'Không thể đăng xuất.'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
