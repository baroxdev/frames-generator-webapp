import { useMutation } from '@tanstack/react-query';
import { Button, Form, Input } from 'antd';
import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { logInMutationOptions } from '../../queries/auth.queries';
import { logInSchema, type LogInInput } from '../../schemas/auth.schema';
import { reportAuthError } from '../../utils/report-auth-error';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

type FieldErrors = Partial<Record<keyof LogInInput, string>>;

export function LoginPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<LogInInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const logInMutation = useMutation(logInMutationOptions());

  const handleChange = (field: keyof LogInInput) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = async () => {
    const parsed = logInSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod<keyof LogInInput>(parsed.error));
      return;
    }
    setErrors({});

    try {
      await logInMutation.mutateAsync(parsed.data);
      navigate({ to: '/account' });
    } catch (error) {
      reportAuthError(error, 'Không thể đăng nhập. Vui lòng thử lại.');
    }
  };

  return (
    <AuthLayout title="Đăng nhập">
      <Form layout="vertical" onFinish={handleSubmit} noValidate>
        <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email}>
          <Input
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            autoComplete="email"
            aria-label="Email"
          />
        </Form.Item>
        <Form.Item label="Mật khẩu" validateStatus={errors.password ? 'error' : ''} help={errors.password}>
          <Input.Password
            value={values.password}
            onChange={handleChange('password')}
            autoComplete="current-password"
            aria-label="Mật khẩu"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={logInMutation.isPending}>
          Đăng nhập
        </Button>
      </Form>
      <div className="flex justify-between text-sm text-gray-500 mt-4">
        <Link to="/forgot-password" className="text-blue-600">
          Quên mật khẩu?
        </Link>
        <Link to="/signup" className="text-blue-600">
          Tạo tài khoản mới
        </Link>
      </div>
    </AuthLayout>
  );
}
