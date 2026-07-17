import { message } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import { AuthServiceError } from '../services/auth.service';
import { reportAuthError } from './report-auth-error';

vi.mock('antd', () => ({
  message: { error: vi.fn() },
}));

describe('reportAuthError', () => {
  it('shows the AuthServiceError message as-is', () => {
    reportAuthError(new AuthServiceError('Email hoặc mật khẩu không đúng.'), 'fallback');

    expect(message.error).toHaveBeenCalledWith('Email hoặc mật khẩu không đúng.');
  });

  it('falls back to the caller-provided message for non-AuthServiceError errors', () => {
    reportAuthError(new Error('network exploded'), 'Không thể thực hiện. Vui lòng thử lại.');

    expect(message.error).toHaveBeenCalledWith('Không thể thực hiện. Vui lòng thử lại.');
  });

  it('falls back for non-Error throwables too', () => {
    reportAuthError('a string was thrown', 'Đã có lỗi xảy ra.');

    expect(message.error).toHaveBeenCalledWith('Đã có lỗi xảy ra.');
  });
});
