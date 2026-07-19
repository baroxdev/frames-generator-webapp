import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { LoginPage } from './LoginPage';

const { mockLogIn, mockNavigate, mockReportAuthError } = vi.hoisted(() => ({
  mockLogIn: vi.fn(),
  mockNavigate: vi.fn(),
  mockReportAuthError: vi.fn(),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../queries/auth.queries', () => ({
  logInMutationOptions: () => ({ mutationFn: mockLogIn }),
}));

vi.mock('../../utils/report-auth-error', () => ({
  reportAuthError: mockReportAuthError,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogIn.mockReset();
    mockNavigate.mockClear();
    mockReportAuthError.mockClear();
  });

  it('submits the mutation with the validated credentials and navigates to /account on success', async () => {
    mockLogIn.mockResolvedValue({ user: { id: 'user-1' }, session: { access_token: 'token' } });
    await renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(mockLogIn).toHaveBeenCalledWith(
        { email: 'owner@example.com', password: 'correct-horse-1' },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/account' }));
  });

  it('shows a validation error and never calls the mutation for an empty password', async () => {
    await renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByText('Vui lòng nhập mật khẩu');
    expect(mockLogIn).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('reports a friendly error and does not navigate when login fails', async () => {
    const failure = new Error('Invalid login credentials');
    mockLogIn.mockRejectedValue(failure);
    await renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(mockReportAuthError).toHaveBeenCalledWith(failure, 'Không thể đăng nhập. Vui lòng thử lại.'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
