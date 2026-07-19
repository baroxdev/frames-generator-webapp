import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Upload, message, type UploadFile, type UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import {
  campaignBySlugQueryOptions,
  campaignKeys,
  campaignsQueryOptions,
  updateCampaignSeoMutationOptions,
  uploadCampaignBackgroundMutationOptions,
} from '../../queries/campaign.queries';
import { campaignSeoSchema } from '../../schemas/campaign.schema';
import { reportCampaignError } from '../../utils/report-campaign-error';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FieldErrors = Partial<Record<'title' | 'description', string>>;

/**
 * Lets an owner (re)set a campaign's SEO/social-share metadata (title,
 * description, thumbnail) any time after creation — the counterpart to
 * NewCampaignPage's own copy of these same fields, for an owner who skipped
 * them at creation or wants to change them later. All three stay optional
 * here too (see resolveCampaignSeo.ts for the fallbacks used when unset).
 *
 * Reuses `campaignsQueryOptions()` to resolve `:id` -> campaign, same as
 * `EditCampaignLayoutPage` — see that page's comment for why this doesn't
 * add a dedicated get-by-id service method.
 */
export function CampaignSeoPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: isSessionLoading } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({ ...campaignsQueryOptions(), enabled: Boolean(user) });
  const campaign = campaignsQuery.data?.find((candidate) => candidate.id === id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailFileList, setThumbnailFileList] = useState<UploadFile[]>([]);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [seeded, setSeeded] = useState(false);

  const thumbnailUploadMutation = useMutation(uploadCampaignBackgroundMutationOptions());
  const updateSeoMutation = useMutation(updateCampaignSeoMutationOptions());

  // Seeds the form from the campaign's *current* saved values exactly once
  // it loads — after that, local state is the source of truth, not this
  // effect re-running on every background refetch (same pattern as
  // EditCampaignLayoutPage's layout-seeding effect).
  useEffect(() => {
    if (campaign && !seeded) {
      setTitle(campaign.title ?? '');
      setDescription(campaign.description ?? '');
      setSeeded(true);
    }
  }, [campaign, seeded]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(thumbnailFile);
    setThumbnailPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnailFile]);

  if (isSessionLoading || campaignsQuery.isLoading) {
    return (
      <OwnerLayout title="SEO & chia sẻ">
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!campaign) {
    return (
      <OwnerLayout title="SEO & chia sẻ">
        <Alert type="error" showIcon message="Không tìm thấy chiến dịch này." />
      </OwnerLayout>
    );
  }

  const handleThumbnailChange: UploadProps['onChange'] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file || !ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
      setThumbnailFileList([]);
      setThumbnailFile(null);
      return;
    }
    setThumbnailFileList(latest);
    setThumbnailFile(file);
  };

  const handleThumbnailRemove = () => {
    setThumbnailFileList([]);
    setThumbnailFile(null);
  };

  const isSubmitting = thumbnailUploadMutation.isPending || updateSeoMutation.isPending;
  const currentThumbnailUrl = thumbnailPreviewUrl ?? campaign.thumbnailUrl ?? campaign.backgroundImageUrl;

  const handleSave = async () => {
    const parsed = campaignSeoSchema.safeParse({ title, description });
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod<'title' | 'description'>(parsed.error));
      return;
    }
    setErrors({});

    try {
      const thumbnailUrl = thumbnailFile
        ? await thumbnailUploadMutation.mutateAsync(thumbnailFile)
        : campaign.thumbnailUrl;

      await updateSeoMutation.mutateAsync({
        campaignId: campaign.id,
        seo: {
          title: parsed.data.title || null,
          description: parsed.data.description || null,
          thumbnailUrl: thumbnailUrl || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      await queryClient.invalidateQueries({ queryKey: campaignBySlugQueryOptions(campaign.slug).queryKey });
      message.success('Đã lưu thông tin SEO.');
      navigate('/campaigns');
    } catch (error) {
      reportCampaignError(error, 'Không thể lưu thông tin SEO. Vui lòng thử lại.');
    }
  };

  return (
    <OwnerLayout title="SEO & chia sẻ">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-700">/{campaign.slug}</h3>
          <Button type="primary" onClick={handleSave} loading={isSubmitting}>
            Lưu
          </Button>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex-1">
            <Form layout="vertical" onFinish={handleSave} noValidate>
              <Form.Item label="Tiêu đề" validateStatus={errors.title ? 'error' : ''} help={errors.title}>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={`/${campaign.slug}`}
                  aria-label="Tiêu đề"
                  maxLength={100}
                />
              </Form.Item>
              <Form.Item
                label="Mô tả"
                validateStatus={errors.description ? 'error' : ''}
                help={errors.description}
              >
                <Input.TextArea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Xem và gửi lời chúc mừng của bạn."
                  aria-label="Mô tả"
                  maxLength={300}
                  rows={3}
                />
              </Form.Item>
            </Form>
          </div>

          <div className="w-full shrink-0 lg:w-48">
            <p className="mb-2 text-sm font-medium text-slate-700">Ảnh thu nhỏ</p>
            {currentThumbnailUrl && (
              <img
                src={currentThumbnailUrl}
                alt=""
                className="mb-2 aspect-square w-full rounded border border-slate-200 object-cover"
              />
            )}
            <Upload
              accept={ALLOWED_THUMBNAIL_TYPES.join(',')}
              listType="picture"
              maxCount={1}
              fileList={thumbnailFileList}
              beforeUpload={() => false}
              onChange={handleThumbnailChange}
              onRemove={handleThumbnailRemove}
              showUploadList={false}
            >
              <Button block>Đổi ảnh</Button>
            </Upload>
            <p className="mt-1 text-xs text-slate-400">Mặc định dùng ảnh nền nếu không chọn.</p>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}
