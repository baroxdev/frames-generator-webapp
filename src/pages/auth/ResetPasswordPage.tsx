import { useMutation } from '@tanstack/react-query';
import { Button, Form, Input, message } from 'antd';
import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import { updatePasswordMutationOptions } from '../../queries/auth.queries';
import { AuthServiceError } from '../../services/auth.service';
import { updatePasswordSchema, type UpdatePasswordInput } from '../../schemas/auth.schema';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

type FieldErrors = Partial<Record<keyof UpdatePasswordInput, string>>;

/**
 * Landing page for the "reset password" email link. Supabase parses the
 * recovery token from the URL and establishes a session automatically
 * (`detectSessionInUrl: true` on the client) before this page renders its
 * form, so a present session here is what proves the link was valid.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, isLoading } = useAuthSession();
  const [values, setValues] = useState<{ password: string; confirmPassword: string }>({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const updatePasswordMutation = useMutation(updatePasswordMutationOptions());

  const handleChange = (field: 'password' | 'confirmPassword') => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = async () => {
    const parsed = updatePasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod<keyof UpdatePasswordInput>(parsed.error));
      return;
    }
    setErrors({});

    try {
      await updatePasswordMutation.mutateAsync({ newPassword: parsed.data.password });
      message.success('Đặt lại mật khẩu thành công.');
      navigate('/account');
    } catch (error) {
      const friendlyMessage = error instanceof AuthServiceError ? error.message : 'Không thể cập nhật mật khẩu.';
      message.error(friendlyMessage);
    }
  };

  if (isLoading) {
    return (
      <AuthLayout title="Đặt lại mật khẩu">
        <p className="text-center text-gray-500">Đang xác minh liên kết...</p>
      </AuthLayout>
    );
  }

  if (!session) {
    return (
      <AuthLayout title="Liên kết không hợp lệ">
        <p className="text-center text-gray-600 mb-4">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu một liên kết mới.
        </p>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-blue-600">
            Yêu cầu liên kết mới
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đặt lại mật khẩu">
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Mật khẩu mới" validateStatus={errors.password ? 'error' : ''} help={errors.password}>
          <Input.Password value={values.password} onChange={handleChange('password')} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Nhập lại mật khẩu mới"
          validateStatus={errors.confirmPassword ? 'error' : ''}
          help={errors.confirmPassword}
        >
          <Input.Password
            value={values.confirmPassword}
            onChange={handleChange('confirmPassword')}
            autoComplete="new-password"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={updatePasswordMutation.isPending}>
          Cập nhật mật khẩu
        </Button>
      </Form>
    </AuthLayout>
  );
}
