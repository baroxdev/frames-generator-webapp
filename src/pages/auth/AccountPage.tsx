import { Button, message } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { AuthServiceError } from '../../services/auth.service';
import { getAuthService } from '../../services/auth.service.instance';

/**
 * Minimal placeholder confirming a logged-in session and exercising logout.
 * The real owner dashboard (campaign list, etc.) is built in a later ticket
 * (#4) on top of the auth wiring this ticket introduces.
 */
export function AccountPage() {
  const { user, session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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
    setLoggingOut(true);
    try {
      await getAuthService().logOut();
      navigate('/login');
    } catch (error) {
      const friendlyMessage = error instanceof AuthServiceError ? error.message : 'Không thể đăng xuất.';
      message.error(friendlyMessage);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <AuthLayout title="Tài khoản">
      <p className="text-center text-gray-600 mb-6">Đăng nhập với: {user.email}</p>
      <Button block loading={loggingOut} onClick={handleLogout}>
        Đăng xuất
      </Button>
    </AuthLayout>
  );
}
