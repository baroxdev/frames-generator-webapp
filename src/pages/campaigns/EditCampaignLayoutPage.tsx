import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, message } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { LayoutEditor } from '../../components/campaigns/LayoutEditor';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import { campaignBySlugQueryOptions, campaignKeys, campaignsQueryOptions, updateCampaignLayoutMutationOptions } from '../../queries/campaign.queries';
import type { CampaignLayout } from '../../templates';
import { reportCampaignError } from '../../utils/report-campaign-error';

/**
 * Lets an owner reopen and re-adjust an already-created campaign's box
 * layout at any time (docs/specs/free-form-layout-editor.md's "Re-edit"
 * flow) — the background image itself isn't editable here, only
 * position/size/shape/color of the four boxes.
 *
 * Reuses `campaignsQueryOptions()` (the same owner-scoped list
 * `CampaignsPage` already fetches) rather than adding a dedicated
 * get-by-id service method — this console's campaign counts are small, and
 * every other owner page already works this way.
 */
export function EditCampaignLayoutPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: isSessionLoading } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({ ...campaignsQueryOptions(), enabled: Boolean(user) });
  const campaign = campaignsQuery.data?.find((candidate) => candidate.id === id);

  const [layout, setLayout] = useState<CampaignLayout | null>(null);
  const updateLayoutMutation = useMutation(updateCampaignLayoutMutationOptions());

  // Seeds the editor from the campaign's *current* saved layout exactly
  // once it loads — after that, `layout` (the owner's in-progress edits) is
  // the source of truth, not this effect re-running on every background
  // refetch.
  useEffect(() => {
    if (campaign && !layout) setLayout(campaign.layout);
  }, [campaign, layout]);

  if (isSessionLoading || campaignsQuery.isLoading) {
    return (
      <OwnerLayout title="Chỉnh sửa bố cục">
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!campaign) {
    return (
      <OwnerLayout title="Chỉnh sửa bố cục">
        <Alert type="error" showIcon message="Không tìm thấy chiến dịch này." />
      </OwnerLayout>
    );
  }

  const handleSave = async () => {
    if (!layout) return;
    try {
      await updateLayoutMutation.mutateAsync({ campaignId: campaign.id, layout });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      await queryClient.invalidateQueries({ queryKey: campaignBySlugQueryOptions(campaign.slug).queryKey });
      message.success('Đã lưu bố cục.');
      navigate('/campaigns');
    } catch (error) {
      reportCampaignError(error, 'Không thể lưu bố cục. Vui lòng thử lại.');
    }
  };

  return (
    <OwnerLayout title="Chỉnh sửa bố cục">
      <Card title={`/${campaign.slug}`} size="small" className="mb-6">
        <p className="mb-4 text-xs text-slate-500">
          Kéo và thay đổi kích thước các ô để tùy chỉnh vị trí ảnh đại diện, tên, chức vụ và thông điệp.
        </p>
        {layout && (
          <LayoutEditor layout={layout} backgroundImageUrl={campaign.backgroundImageUrl} onChange={setLayout} />
        )}
      </Card>
      <Button type="primary" onClick={handleSave} loading={updateLayoutMutation.isPending} disabled={!layout}>
        Lưu bố cục
      </Button>
    </OwnerLayout>
  );
}
