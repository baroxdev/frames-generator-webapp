import { Link } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuthSession } from '../../hooks/useAuthSession';

/**
 * Landing page for the "verify email" link from the sign-up confirmation
 * email. By the time this renders, Supabase has already confirmed the
 * account server-side and (via `detectSessionInUrl`) established a session
 * from the token in the URL — this page just reports the outcome.
 */
export function AuthConfirmPage() {
  const { session, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <AuthLayout title="Xác minh email">
        <p className="text-center text-gray-500">Đang xác minh...</p>
      </AuthLayout>
    );
  }

  if (!session) {
    return (
      <AuthLayout title="Không thể xác minh">
        <p className="text-center text-gray-600 mb-4">
          Liên kết xác minh không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập để nhận liên kết xác minh mới.
        </p>
        <p className="text-center text-sm">
          <Link to="/login" className="text-blue-600">
            Đến trang đăng nhập
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Xác minh email thành công">
      <p className="text-center text-gray-600 mb-4">Tài khoản của bạn đã được xác minh. Bạn có thể bắt đầu sử dụng.</p>
      <p className="text-center text-sm">
        <Link to="/account" className="text-blue-600">
          Tiếp tục
        </Link>
      </p>
    </AuthLayout>
  );
}
