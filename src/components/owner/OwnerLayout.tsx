import {
  ArrowLeftOutlined,
  LogoutOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Layout,
  Menu,
  Typography,
  type MenuProps,
} from "antd";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuthSession } from "../../hooks/useAuthSession";
import { logOutMutationOptions } from "../../queries/auth.queries";
import { reportAuthError } from "../../utils/report-auth-error";

const { Sider, Header, Content } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS: MenuProps["items"] = [
  {
    key: "campaigns-group",
    label: "Chiến dịch",
    type: "group",
    children: [
      {
        key: "/campaigns",
        icon: <UnorderedListOutlined />,
        label: "Danh sách",
      },
      { key: "/campaigns/new", icon: <PlusOutlined />, label: "Tạo mới" },
    ],
  },
];

export function OwnerLayout({
  title,
  children,
  hideSider = false,
}: {
  title: string;
  children: ReactNode;
  /** Collapses the global nav sider for full-screen editor-style pages
   * (e.g. NewCampaignPage) — a "← Back" button in the header takes over
   * getting back to the campaign list in its place. */
  hideSider?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const logOutMutation = useMutation(logOutMutationOptions());

  const handleMenuClick: MenuProps["onClick"] = (info) =>
    navigate({ to: info.key });

  const handleLogout = async () => {
    try {
      await logOutMutation.mutateAsync();
      navigate({ to: "/login" });
    } catch (error) {
      reportAuthError(error, "Không thể đăng xuất.");
    }
  };

  const emailInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <Layout className="h-screen overflow-hidden">
      {!hideSider && (
        <Sider
          theme="light"
          width={240}
          className="!border-r !border-slate-100"
        >
          <div className="px-6 py-5 text-base font-semibold text-slate-800">
            Frame Generator
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={["campaigns-group"]}
            items={NAV_ITEMS}
            onClick={handleMenuClick}
            className="!border-none"
          />
        </Sider>
      )}
      <Layout>
        <Header className="!flex !items-center !justify-between !bg-white !px-6 border-b">
          <div className="flex items-center gap-3">
            {hideSider && (
              <Button
                type="text"
                aria-label="Quay lại"
                title="Quay lại"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate({ to: "/campaigns" })}
              />
            )}
            <Title level={5} className="!mb-0">
              {title}
            </Title>
          </div>
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
        <Content className="min-h-0 flex-1 overflow-y-auto rounded-none">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
