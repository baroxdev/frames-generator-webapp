import { InboxOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Upload, message, type UploadFile, type UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { LayoutEditor } from '../../components/campaigns/LayoutEditor';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import {
  campaignKeys,
  createCampaignMutationOptions,
  slugAvailabilityQueryOptions,
  uploadCampaignBackgroundMutationOptions,
} from '../../queries/campaign.queries';
import { createCampaignSchema, slugField, type CreateCampaignInput } from '../../schemas/campaign.schema';
import { getDefaultCampaignLayout, type CampaignLayout } from '../../templates';
import { getImageDimensions } from '../../utils/get-image-dimensions';
import { reportCampaignError } from '../../utils/report-campaign-error';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

const ALLOWED_BACKGROUND_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SLUG_DEBOUNCE_MS = 400;

type FieldErrors = Partial<Record<keyof CreateCampaignInput, string>> & { backgroundImage?: string };

export function NewCampaignPage() {
  const { user, isLoading } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundFileList, setBackgroundFileList] = useState<UploadFile[]>([]);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const [layout, setLayout] = useState<CampaignLayout | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [debouncedSlug] = useDebounce(slug.trim(), SLUG_DEBOUNCE_MS);

  const uploadMutation = useMutation(uploadCampaignBackgroundMutationOptions());
  const createMutation = useMutation(createCampaignMutationOptions());

  const slugFormatValid = slugField.safeParse(debouncedSlug).success;
  const slugAvailabilityQuery = useQuery({
    ...slugAvailabilityQueryOptions(debouncedSlug),
    enabled: slugFormatValid,
  });

  useEffect(() => {
    if (!backgroundFile) {
      setBackgroundPreviewUrl(null);
      setLayout(null);
      return;
    }
    const url = URL.createObjectURL(backgroundFile);
    setBackgroundPreviewUrl(url);

    // The editor's default box layout is a one-time computation derived
    // from this specific upload's own pixel dimensions (see
    // docs/specs/free-form-layout-editor.md) — picking a different
    // background before submit recomputes it from scratch, same as
    // choosing one the first time. Once the owner starts dragging, their
    // edits (held in `layout` state) are the new source of truth, not this
    // effect.
    let cancelled = false;
    (async () => {
      try {
        const canvas = await getImageDimensions(backgroundFile);
        if (!cancelled) setLayout(getDefaultCampaignLayout(canvas));
      } catch {
        if (!cancelled) {
          setErrors((previous) => ({ ...previous, backgroundImage: 'Không thể đọc kích thước ảnh nền.' }));
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [backgroundFile]);

  if (isLoading) {
    return (
      <OwnerLayout title="Tạo chiến dịch mới">
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleBackgroundChange: UploadProps['onChange'] = (info) => {
    // maxCount={1} already keeps antd's own list to one entry, but guard
    // here too since onChange fires with the full list on every event.
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file) {
      setBackgroundFileList([]);
      setBackgroundFile(null);
      return;
    }
    if (!ALLOWED_BACKGROUND_TYPES.includes(file.type)) {
      setErrors((previous) => ({ ...previous, backgroundImage: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP' }));
      setBackgroundFileList([]);
      setBackgroundFile(null);
      return;
    }
    setErrors((previous) => ({ ...previous, backgroundImage: undefined }));
    setBackgroundFileList(latest);
    setBackgroundFile(file);
  };

  const handleBackgroundRemove = () => {
    setBackgroundFileList([]);
    setBackgroundFile(null);
  };

  const isSubmitting = uploadMutation.isPending || createMutation.isPending;

  const handleSubmit = async () => {
    const parsed = createCampaignSchema.safeParse({ slug: slug.trim(), layout });
    const fieldErrors: FieldErrors = parsed.success ? {} : fieldErrorsFromZod<keyof CreateCampaignInput>(parsed.error);
    if (!backgroundFile) {
      fieldErrors.backgroundImage = 'Vui lòng tải ảnh nền lên';
    }
    if (parsed.success && slugFormatValid && slugAvailabilityQuery.data === false) {
      fieldErrors.slug = 'Đường dẫn này đã được sử dụng. Vui lòng chọn đường dẫn khác.';
    }
    if (!parsed.success || !backgroundFile || Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      const backgroundImageUrl = await uploadMutation.mutateAsync(backgroundFile);
      await createMutation.mutateAsync({
        slug: parsed.data.slug,
        layout: parsed.data.layout,
        backgroundImageUrl,
      });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      message.success('Chiến dịch đã được tạo và đang chờ duyệt. Đường dẫn sẽ chưa công khai cho đến khi được duyệt.');
      navigate('/campaigns');
    } catch (error) {
      reportCampaignError(error, 'Không thể tạo chiến dịch. Vui lòng thử lại.');
    }
  };

  return (
    <OwnerLayout title="Tạo chiến dịch mới">
      <Form layout="vertical" onFinish={handleSubmit} noValidate>
        <Form.Item label="Đường dẫn" validateStatus={errors.slug ? 'error' : ''} help={errors.slug}>
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="dai-hoi-ben-tre"
            aria-label="Đường dẫn"
          />
        </Form.Item>
        {!errors.slug && slugFormatValid && slugAvailabilityQuery.data === true && (
          <p className="-mt-4 mb-4 text-xs text-green-600">Đường dẫn khả dụng</p>
        )}
        {!errors.slug && slugFormatValid && slugAvailabilityQuery.data === false && (
          <p className="-mt-4 mb-4 text-xs text-red-600">Đường dẫn này đã được sử dụng</p>
        )}

        <Form.Item label="Ảnh nền" validateStatus={errors.backgroundImage ? 'error' : ''} help={errors.backgroundImage}>
          <Upload.Dragger
            accept={ALLOWED_BACKGROUND_TYPES.join(',')}
            listType="picture"
            maxCount={1}
            fileList={backgroundFileList}
            beforeUpload={() => false}
            onChange={handleBackgroundChange}
            onRemove={handleBackgroundRemove}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Kéo thả ảnh vào đây, hoặc bấm để chọn ảnh</p>
            <p className="ant-upload-hint">Chấp nhận JPEG, PNG hoặc WEBP</p>
          </Upload.Dragger>
        </Form.Item>

        {backgroundPreviewUrl && layout && (
          <Card title="Bố trí khung ảnh" size="small" className="mb-6">
            <p className="mb-4 text-xs text-slate-500">
              Kéo và thay đổi kích thước các ô để tùy chỉnh vị trí ảnh đại diện, tên, chức vụ và thông điệp.
            </p>
            <LayoutEditor layout={layout} backgroundImageUrl={backgroundPreviewUrl} onChange={setLayout} />
          </Card>
        )}

        <Button type="primary" htmlType="submit" block loading={isSubmitting}>
          Tạo chiến dịch
        </Button>
      </Form>
    </OwnerLayout>
  );
}
