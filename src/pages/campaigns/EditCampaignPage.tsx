import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Upload, message, type UploadFile, type UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { LayoutEditor } from '../../components/campaigns/LayoutEditor';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import {
  campaignBySlugQueryOptions,
  campaignKeys,
  campaignsQueryOptions,
  updateCampaignDetailsMutationOptions,
  uploadCampaignBackgroundMutationOptions,
  uploadCampaignHeaderMutationOptions,
} from '../../queries/campaign.queries';
import { campaignSeoSchema } from '../../schemas/campaign.schema';
import type { CampaignLayout } from '../../templates';
import { reportCampaignError } from '../../utils/report-campaign-error';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FieldErrors = Partial<Record<'title' | 'description', string>>;

/**
 * Single owner-facing page for everything about an already-created campaign:
 * SEO/social-share metadata, the public-page header banner, and the
 * free-form box layout — merged from what used to be CampaignSeoPage and
 * EditCampaignLayoutPage into one page with one Save action (see
 * set_campaign_details / 0007_campaign_header_image.sql). The background
 * image itself still isn't editable here, only these three concerns.
 *
 * Reuses `campaignsQueryOptions()` to resolve `:id` -> campaign, same as
 * the pages this replaces — this console's campaign counts are small, and
 * every other owner page already works this way.
 */
export function EditCampaignPage() {
  const { id } = useParams({ strict: false }) as { id: string };
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
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerFileList, setHeaderFileList] = useState<UploadFile[]>([]);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [layout, setLayout] = useState<CampaignLayout | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [seeded, setSeeded] = useState(false);

  const thumbnailUploadMutation = useMutation(uploadCampaignBackgroundMutationOptions());
  const headerUploadMutation = useMutation(uploadCampaignHeaderMutationOptions());
  const updateDetailsMutation = useMutation(updateCampaignDetailsMutationOptions());

  // Seeds the form from the campaign's *current* saved values exactly once
  // it loads — after that, local state is the source of truth, not this
  // effect re-running on every background refetch.
  useEffect(() => {
    if (campaign && !seeded) {
      setTitle(campaign.title ?? '');
      setDescription(campaign.description ?? '');
      setLayout(campaign.layout);
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

  useEffect(() => {
    if (!headerFile) {
      setHeaderPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(headerFile);
    setHeaderPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [headerFile]);

  if (isSessionLoading || campaignsQuery.isLoading) {
    return (
      <OwnerLayout title="Chỉnh sửa chiến dịch">
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!campaign) {
    return (
      <OwnerLayout title="Chỉnh sửa chiến dịch">
        <Alert type="error" showIcon message="Không tìm thấy chiến dịch này." />
      </OwnerLayout>
    );
  }

  const handleThumbnailChange: UploadProps['onChange'] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
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

  const handleHeaderChange: UploadProps['onChange'] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setHeaderFileList([]);
      setHeaderFile(null);
      return;
    }
    setHeaderFileList(latest);
    setHeaderFile(file);
  };

  const handleHeaderRemove = () => {
    setHeaderFileList([]);
    setHeaderFile(null);
  };

  const isSubmitting =
    thumbnailUploadMutation.isPending || headerUploadMutation.isPending || updateDetailsMutation.isPending;
  const currentThumbnailUrl = thumbnailPreviewUrl ?? campaign.thumbnailUrl ?? campaign.backgroundImageUrl;
  const currentHeaderUrl = headerPreviewUrl ?? campaign.headerImageUrl;

  const handleSave = async () => {
    const parsed = campaignSeoSchema.safeParse({ title, description });
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod<'title' | 'description'>(parsed.error));
      return;
    }
    setErrors({});
    if (!layout) return;

    try {
      const thumbnailUrl = thumbnailFile
        ? await thumbnailUploadMutation.mutateAsync(thumbnailFile)
        : campaign.thumbnailUrl;
      const headerImageUrl = headerFile
        ? await headerUploadMutation.mutateAsync(headerFile)
        : campaign.headerImageUrl;

      await updateDetailsMutation.mutateAsync({
        campaignId: campaign.id,
        details: {
          title: parsed.data.title || null,
          description: parsed.data.description || null,
          thumbnailUrl: thumbnailUrl || null,
          headerImageUrl: headerImageUrl || null,
          layout,
        },
      });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      await queryClient.invalidateQueries({ queryKey: campaignBySlugQueryOptions(campaign.slug).queryKey });
      message.success('Đã lưu chiến dịch.');
      navigate({ to: '/campaigns' });
    } catch (error) {
      reportCampaignError(error, 'Không thể lưu chiến dịch. Vui lòng thử lại.');
    }
  };

  return (
    <OwnerLayout title="Chỉnh sửa chiến dịch">
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-700">/{campaign.slug}</h3>
          <Button type="primary" onClick={handleSave} loading={isSubmitting} disabled={!layout}>
            Lưu
          </Button>
        </div>

        <section className="flex flex-col gap-4">
          <h4 className="text-sm font-semibold text-slate-700">SEO & chia sẻ</h4>
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
                accept={ALLOWED_IMAGE_TYPES.join(',')}
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
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Ảnh bìa trang chiến dịch</h4>
            <p className="text-xs text-slate-500">
              Hiển thị ở đầu trang công khai của chiến dịch. Có thể tải lên ảnh với bất kỳ tỷ lệ nào — ảnh sẽ được
              hiển thị đúng theo kích thước gốc.
            </p>
          </div>
          {currentHeaderUrl ? (
            <img src={currentHeaderUrl} alt="" className="w-full max-w-2xl rounded border border-slate-200" />
          ) : (
            <div className="flex w-full max-w-2xl items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 py-10 text-sm text-slate-400">
              Chưa có ảnh bìa
            </div>
          )}
          <Upload
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            listType="picture"
            maxCount={1}
            fileList={headerFileList}
            beforeUpload={() => false}
            onChange={handleHeaderChange}
            onRemove={handleHeaderRemove}
            showUploadList={false}
          >
            <Button>{currentHeaderUrl ? 'Đổi ảnh bìa' : 'Tải ảnh bìa lên'}</Button>
          </Upload>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Bố cục</h4>
            <p className="text-xs text-slate-500">
              Kéo và thay đổi kích thước các ô để tùy chỉnh vị trí ảnh đại diện, tên, chức vụ và thông điệp.
            </p>
          </div>
          {layout && (
            <LayoutEditor layout={layout} backgroundImageUrl={campaign.backgroundImageUrl} onChange={setLayout} />
          )}
        </section>
      </div>
    </OwnerLayout>
  );
}
