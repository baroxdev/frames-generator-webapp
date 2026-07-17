import { Alert } from 'antd';

/** Shown instead of an auth form when Supabase/Turnstile env vars aren't set yet. */
export function ConfigErrorNotice({ message }: { message: string }) {
  return (
    <Alert
      type="error"
      showIcon
      message="Chức năng đăng nhập chưa sẵn sàng"
      description={message}
      className="max-w-md"
    />
  );
}
