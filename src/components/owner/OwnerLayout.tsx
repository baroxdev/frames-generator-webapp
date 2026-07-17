import { LogoutOutlined, PlusOutlined, ProjectOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Avatar, Breadcrumb, Button, Layout, Menu, Typography, type MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../hooks/useAuthSession';
import { logOutMutationOptions } from '../../queries/auth.queries';
import { reportAuthError } from '../../utils/report-auth-error';

const { Sider, Header, Content } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS: MenuProps['items'] = [
  {
    key: 'campaigns-group',
    label: 'Chiến dịch',
    type: 'group',
    children: [
      { key: '/campaigns', icon: <UnorderedListOutlined />, label: 'Danh sách' },
      { key: '/campaigns/new', icon: <PlusOutlined />, label: 'Tạo mới' },
    ],
  },
];

/** Route -> the leaf breadcrumb label for that route, under the "Chiến dịch" group. */
const BREADCRUMB_LEAF: Record<string, string> = {
  '/campaigns': 'Danh sách',
  '/campaigns/new': 'Tạo mới',
};

/**
 * Shared dashboard chrome for the logged-in owner console pages (campaign
 * list, create campaign): a sidebar nav plus a main content panel. Wider
 * than AuthLayout on purpose — those pages host a template gallery and a
 * live preview, not a single narrow form.
 */
export function OwnerLayout({ title, children }: { title: string; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const logOutMutation = useMutation(logOutMutationOptions());

  const handleMenuClick: MenuProps['onClick'] = (info) => navigate(info.key);

  const handleLogout = async () => {
    try {
      await logOutMutation.mutateAsync();
      navigate('/login');
    } catch (error) {
      reportAuthError(error, 'Không thể đăng xuất.');
    }
  };

  const emailInitial = user?.email?.[0]?.toUpperCase() ?? '?';
  const breadcrumbItems = [
    { title: <ProjectOutlined /> },
    { title: 'Chiến dịch' },
    { title: BREADCRUMB_LEAF[location.pathname] ?? title },
  ];

  return (
    <Layout className="min-h-screen">
      <Sider theme="light" width={240} className="!border-r !border-slate-100">
        <div className="px-6 py-5 text-base font-semibold text-slate-800">Frame Generator</div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['campaigns-group']}
          items={NAV_ITEMS}
          onClick={handleMenuClick}
          className="!border-none"
        />
      </Sider>
      <Layout>
        <Header className="!flex !items-center !justify-end !bg-white !px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar>{emailInitial}</Avatar>
            <Text className="hidden sm:inline">{user?.email}</Text>
            <Button
              type="text"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            />
          </div>
        </Header>
        <Content className="p-8">
          <Breadcrumb items={breadcrumbItems} className="!mb-3" />
          <Title level={4} className="!mb-4">
            {title}
          </Title>
          <div className="rounded-lg bg-white p-8 shadow">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
