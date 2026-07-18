import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReset } = vi.hoisted(() => ({ mockReset: vi.fn() }));

vi.mock('../auth/TurnstileWidget', () => ({
  TurnstileWidget: forwardRef(function MockTurnstileWidget(
    { onVerify }: { onVerify: (token: string) => void },
    ref: React.Ref<{ reset: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({ reset: mockReset }));
    return (
      <button type="button" onClick={() => onVerify('turnstile-token')}>
        Verify CAPTCHA
      </button>
    );
  }),
}));

import { TributeForm } from './TributeForm';

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByLabelText('Đơn vị'), { target: { value: 'Cựu học sinh khóa 2010' } });
  fireEvent.change(screen.getByLabelText('Thông điệp'), { target: { value: 'Chúc mừng đại hội thành công tốt đẹp!' } });

  const avatarFile = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [avatarFile] } });

  fireEvent.click(screen.getByText('Verify CAPTCHA'));
}

describe('TributeForm', () => {
  beforeEach(() => {
    mockReset.mockClear();
  });

  it('shows validation errors and does not submit when required fields are missing', async () => {
    const onSubmit = vi.fn();
    render(<TributeForm turnstileSiteKey="test-site-key" isSubmitting={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('Gửi thông điệp'));

    await waitFor(() => expect(screen.getByText('Vui lòng thêm ảnh đại diện')).toBeTruthy());
    expect(screen.getByText('Vui lòng xác thực CAPTCHA')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the full payload (including the avatar file and turnstile token) once every field is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TributeForm turnstileSiteKey="test-site-key" isSubmitting={false} onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.click(screen.getByText('Gửi thông điệp'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.fullName).toBe('Nguyễn Văn A');
    expect(submitted.role).toBe('Cựu học sinh khóa 2010');
    expect(submitted.message).toBe('Chúc mừng đại hội thành công tốt đẹp!');
    expect(submitted.avatarFile).toBeInstanceOf(File);
    expect(submitted.turnstileToken).toBe('turnstile-token');
  });

  it('resets the Turnstile widget and clears the token when the submission rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('campaign full'));
    render(<TributeForm turnstileSiteKey="test-site-key" isSubmitting={false} onSubmit={onSubmit} />);

    fillValidForm();
    fireEvent.click(screen.getByText('Gửi thông điệp'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));

    // The token was cleared, so submitting again without re-verifying is blocked client-side.
    fireEvent.click(screen.getByText('Gửi thông điệp'));
    await waitFor(() => expect(screen.getByText('Vui lòng xác thực CAPTCHA')).toBeTruthy());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the consent notice near the submit action', () => {
    render(<TributeForm turnstileSiteKey="test-site-key" isSubmitting={false} onSubmit={vi.fn()} />);

    expect(
      screen.getByText('Bằng việc gửi, bạn đồng ý cho phép chiến dịch sử dụng ảnh và thông tin này để tạo khung ảnh tri ân công khai.'),
    ).toBeTruthy();
  });
});
