import { Button, Form, Input, message } from 'antd';
import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { AuthServiceError } from '../../services/auth.service';
import { getAuthService } from '../../services/auth.service.instance';
import { logInSchema, type LogInInput } from '../../schemas/auth.schema';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

type FieldErrors = Partial<Record<keyof LogInInput, string>>;

export function LoginPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<LogInInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);

    try {
      await getAuthService().logIn(parsed.data);
      navigate('/account');
    } catch (error) {
      const friendlyMessage = error instanceof AuthServiceError ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.';
      message.error(friendlyMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Đăng nhập">
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email}>
          <Input type="email" value={values.email} onChange={handleChange('email')} autoComplete="email" />
        </Form.Item>
        <Form.Item label="Mật khẩu" validateStatus={errors.password ? 'error' : ''} help={errors.password}>
          <Input.Password
            value={values.password}
            onChange={handleChange('password')}
            autoComplete="current-password"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
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
