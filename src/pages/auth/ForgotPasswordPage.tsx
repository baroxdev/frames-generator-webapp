import { useMutation } from '@tanstack/react-query';
import { Button, Form, Input, message } from 'antd';
import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { requestPasswordResetMutationOptions } from '../../queries/auth.queries';
import { AuthServiceError } from '../../services/auth.service';
import { requestPasswordResetSchema, type RequestPasswordResetInput } from '../../schemas/auth.schema';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

type FieldErrors = Partial<Record<keyof RequestPasswordResetInput, string>>;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const requestPasswordResetMutation = useMutation(requestPasswordResetMutationOptions());

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value);

  const handleSubmit = async () => {
    const parsed = requestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod<keyof RequestPasswordResetInput>(parsed.error));
      return;
    }
    setErrors({});

    try {
      await requestPasswordResetMutation.mutateAsync({
        email: parsed.data.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSubmitted(true);
    } catch (error) {
      const friendlyMessage =
        error instanceof AuthServiceError ? error.message : 'Không thể gửi email đặt lại mật khẩu.';
      message.error(friendlyMessage);
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Kiểm tra email của bạn">
        <p className="text-center text-gray-600">
          Nếu <strong>{email}</strong> có tài khoản, chúng tôi đã gửi một liên kết đặt lại mật khẩu đến email đó.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Quên mật khẩu">
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email}>
          <Input type="email" value={email} onChange={handleChange} autoComplete="email" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={requestPasswordResetMutation.isPending}>
          Gửi liên kết đặt lại mật khẩu
        </Button>
      </Form>
      <p className="text-center text-sm text-gray-500 mt-4">
        <Link to="/login" className="text-blue-600">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
