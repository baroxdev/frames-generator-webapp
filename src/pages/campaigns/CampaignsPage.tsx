import { ExportOutlined, FacebookOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect } from 'react';
import { Link, Navigate } from '@tanstack/react-router';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { getEnv } from '../../config/env';
import { useAuthSession } from '../../hooks/useAuthSession';
import { loadFacebookSdk } from '../../lib/facebookSdk';
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

// Mirrors 0002_public_approved_campaigns.sql's RLS policy: a campaign's
// public page is reachable by anyone once `status = 'approved'`,
// regardless of `visibility` (that field only affects the public gallery
// listing, ticket #8) — so that's the right gate for "is there a page here
// worth opening/sharing" too, not `visibility`.
function isPubliclyReachable(campaign: Campaign): boolean {
  return campaign.status === 'approved';
}

/**
 * Opens Facebook's Share Dialog for a campaign's public page via the JS
 * SDK (FB.ui({ method: 'share' })) rather than a bare link to
 * facebook.com/sharer or facebook.com/dialog/feed — both of those were
 * tried first and don't reliably work: sharer.php is undocumented and the
 * Feed Dialog needs App Domains/Valid OAuth Redirect URIs configured on
 * the Facebook App just to redirect back, on top of an App ID. The Share
 * Dialog needs neither.
 *
 * `loadFacebookSdk` is expected to have already been kicked off on mount
 * (see the `useEffect` in `CampaignsPage`) so `window.FB` is normally
 * already warm by the time this fires — calling `FB.ui()` synchronously
 * within the click handler (not after an `await`) is what keeps its popup
 * from being treated as an untrusted, non-user-gesture popup and blocked,
 * the same trap the earlier `window.open()` attempt fell into.
 */
function shareToFacebook(appId: string, slug: string) {
  const href = `${window.location.origin}/${slug}`;
  if (window.FB) {
    window.FB.ui({ method: 'share', href }, () => undefined);
    return;
  }
  loadFacebookSdk(appId).then((FB) => FB.ui({ method: 'share', href }, () => undefined));
}

function buildColumns(facebookAppId: string): ColumnsType<Campaign> {
  return [
    {
      title: 'Đường dẫn',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug: string) => (
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-blue-600"
        >
          /{slug} <ExportOutlined className="text-xs" />
        </a>
      ),
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
        <span className="flex items-center gap-3">
          <Link to="/campaigns/$id/edit" params={{ id: campaign.id }}>
            Chỉnh sửa
          </Link>
          <Link to="/campaigns/$id/submissions" params={{ id: campaign.id }}>
            Lượt gửi
          </Link>
          {isPubliclyReachable(campaign) && (
            <Button
              type="text"
              size="small"
              icon={<FacebookOutlined />}
              aria-label="Chia sẻ lên Facebook"
              onClick={() => shareToFacebook(facebookAppId, campaign.slug)}
            />
          )}
        </span>
      ),
    },
  ];
}

export function CampaignsPage() {
  const { user, isLoading: isSessionLoading } = useAuthSession();
  const campaignsQuery = useQuery({ ...campaignsQueryOptions(), enabled: Boolean(user) });

  // Kicked off as early as possible (not at share-click time) so window.FB
  // is normally already ready by the time the owner clicks — see
  // shareToFacebook's comment for why that matters.
  useEffect(() => {
    loadFacebookSdk(getEnv().VITE_FACEBOOK_APP_ID);
  }, []);

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
          columns={buildColumns(getEnv().VITE_FACEBOOK_APP_ID)}
          dataSource={campaignsQuery.data ?? []}
          loading={campaignsQuery.isLoading}
          pagination={false}
          locale={{ emptyText: 'Bạn chưa có chiến dịch nào.' }}
        />
      </div>
    </OwnerLayout>
  );
}
