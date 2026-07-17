import { Button, Form, Input, message } from 'antd';
import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { ConfigErrorNotice } from '../../components/auth/ConfigErrorNotice';
import { TurnstileWidget } from '../../components/auth/TurnstileWidget';
import { useEnv } from '../../config/useEnv';
import { AuthServiceError } from '../../services/auth.service';
import { getAuthService } from '../../services/auth.service.instance';
import { signUpSchema, type SignUpInput } from '../../schemas/auth.schema';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

type FormValues = { email: string; password: string; confirmPassword: string };
type FieldErrors = Partial<Record<keyof SignUpInput, string>>;

export function SignUpPage() {
  const { env, error: envError } = useEnv();
  const [values, setValues] = useState<FormValues>({ email: '', password: '', confirmPassword: '' });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (envError || !env) {
    return (
      <AuthLayout title="Đăng ký tài khoản">
        <ConfigErrorNotice message={envError ?? 'Thiếu cấu hình.'} />
      </AuthLayout>
    );
  }

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = async () => {
    const parsed = signUpSchema.safeParse({ ...values, captchaToken: captchaToken ?? '' });
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod<keyof SignUpInput>(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await getAuthService().signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        captchaToken: parsed.data.captchaToken,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      });
      setSubmitted(true);
    } catch (error) {
      const friendlyMessage = error instanceof AuthServiceError ? error.message : 'Không thể tạo tài khoản. Vui lòng thử lại.';
      message.error(friendlyMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Kiểm tra email của bạn">
        <p className="text-center text-gray-600">
          Chúng tôi đã gửi một email xác minh đến <strong>{values.email}</strong>. Vui lòng bấm vào liên kết trong
          email để hoàn tất đăng ký.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đăng ký tài khoản">
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email}>
          <Input
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            autoComplete="email"
            placeholder="ban@vidu.com"
          />
        </Form.Item>
        <Form.Item label="Mật khẩu" validateStatus={errors.password ? 'error' : ''} help={errors.password}>
          <Input.Password value={values.password} onChange={handleChange('password')} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Nhập lại mật khẩu"
          validateStatus={errors.confirmPassword ? 'error' : ''}
          help={errors.confirmPassword}
        >
          <Input.Password
            value={values.confirmPassword}
            onChange={handleChange('confirmPassword')}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item validateStatus={errors.captchaToken ? 'error' : ''} help={errors.captchaToken}>
          <TurnstileWidget
            siteKey={env.VITE_TURNSTILE_SITE_KEY}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Đăng ký
        </Button>
      </Form>
      <p className="text-center text-sm text-gray-500 mt-4">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-blue-600">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
