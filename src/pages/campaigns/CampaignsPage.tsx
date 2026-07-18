import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, Navigate } from 'react-router-dom';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import { campaignsQueryOptions } from '../../queries/campaign.queries';
import type { Campaign, CampaignStatus } from '../../services/campaign.service';
import { getTemplateById } from '../../templates';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  pending: 'Đang chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  suspended: 'Đã tạm ngưng',
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  suspended: 'default',
};

const COLUMNS: ColumnsType<Campaign> = [
  {
    title: 'Đường dẫn',
    dataIndex: 'slug',
    key: 'slug',
    render: (slug: string) => <span className="font-medium text-slate-800">/{slug}</span>,
  },
  {
    title: 'Mẫu khung',
    dataIndex: 'templateId',
    key: 'templateId',
    render: (templateId: string) => getTemplateById(templateId)?.name ?? templateId,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    render: (status: CampaignStatus) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>,
  },
  {
    title: 'Hiển thị',
    dataIndex: 'visibility',
    key: 'visibility',
    render: (visibility: Campaign['visibility']) => (visibility === 'public' ? 'Công khai' : 'Riêng tư'),
  },
  {
    title: 'Lượt gửi',
    dataIndex: 'submissionCount',
    key: 'submissionCount',
  },
  {
    title: 'Ngày tạo',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (createdAt: string) => new Date(createdAt).toLocaleDateString('vi-VN'),
  },
  {
    title: '',
    key: 'actions',
    render: (_: unknown, campaign: Campaign) => (
      <span className="flex gap-3">
        <Link to={`/campaigns/${campaign.id}/edit`}>Chỉnh sửa bố cục</Link>
        <Link to={`/campaigns/${campaign.id}/submissions`}>Lượt gửi</Link>
      </span>
    ),
  },
];

export function CampaignsPage() {
  const { user, isLoading: isSessionLoading } = useAuthSession();
  const campaignsQuery = useQuery({ ...campaignsQueryOptions(), enabled: Boolean(user) });

  if (isSessionLoading) {
    return (
      <OwnerLayout title="Chiến dịch của tôi">
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <OwnerLayout title="Chiến dịch của tôi">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Link to="/campaigns/new">
            <Button type="primary">Tạo chiến dịch mới</Button>
          </Link>
        </div>

        {campaignsQuery.isError && (
          <Alert type="error" showIcon message="Không thể tải danh sách chiến dịch. Vui lòng thử lại." />
        )}

        <Table<Campaign>
          rowKey="id"
          columns={COLUMNS}
          dataSource={campaignsQuery.data ?? []}
          loading={campaignsQuery.isLoading}
          pagination={false}
          locale={{ emptyText: 'Bạn chưa có chiến dịch nào.' }}
        />
      </div>
    </OwnerLayout>
  );
}
