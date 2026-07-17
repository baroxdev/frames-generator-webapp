import { useMutation } from '@tanstack/react-query';
import { Button } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import { logOutMutationOptions } from '../../queries/auth.queries';
import { reportAuthError } from '../../utils/report-auth-error';

/**
 * Minimal placeholder confirming a logged-in session and exercising logout.
 * The real owner dashboard (campaign list, etc.) is built in a later ticket
 * (#4) on top of the auth wiring this ticket introduces.
 */
export function AccountPage() {
  const { user, session, isLoading } = useAuthSession();
  const navigate = useNavigate();
  const logOutMutation = useMutation(logOutMutationOptions());

  if (isLoading) {
    return (
      <AuthLayout title="Tài khoản">
        <p className="text-center text-gray-500">Đang tải...</p>
      </AuthLayout>
    );
  }

  if (!session || !user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await logOutMutation.mutateAsync();
      navigate('/login');
    } catch (error) {
      reportAuthError(error, 'Không thể đăng xuất.');
    }
  };

  return (
    <AuthLayout title="Tài khoản">
      <p className="text-center text-gray-600 mb-6">Đăng nhập với: {user.email}</p>
      <Button block loading={logOutMutation.isPending} onClick={handleLogout}>
        Đăng xuất
      </Button>
    </AuthLayout>
  );
}
