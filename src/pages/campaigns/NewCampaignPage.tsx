import { InboxOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Upload, message, type UploadFile, type UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import PrintArea from '../../components/PrintArea';
import TemplateGallery from '../../components/TemplateGallery';
import { useAuthSession } from '../../hooks/useAuthSession';
import {
  campaignKeys,
  createCampaignMutationOptions,
  slugAvailabilityQueryOptions,
  uploadCampaignBackgroundMutationOptions,
} from '../../queries/campaign.queries';
import { createCampaignSchema, slugField, type CreateCampaignInput } from '../../schemas/campaign.schema';
import { DEFAULT_TEMPLATE_ID, getTemplateById, getTemplateGallery } from '../../templates';
import { reportCampaignError } from '../../utils/report-campaign-error';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

const ALLOWED_BACKGROUND_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SLUG_DEBOUNCE_MS = 400;
// Fixed on-screen width for the live preview; the template's own canvas can
// be far wider than a form column, so it's scaled down uniformly to fit.
const PREVIEW_DISPLAY_WIDTH = 480;

type FieldErrors = Partial<Record<keyof CreateCampaignInput, string>> & { backgroundImage?: string };

export function NewCampaignPage() {
  const { user, isLoading } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundFileList, setBackgroundFileList] = useState<UploadFile[]>([]);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
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
      return;
    }
    const url = URL.createObjectURL(backgroundFile);
    setBackgroundPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
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

  const templateGallery = getTemplateGallery();
  const selectedTemplate = getTemplateById(templateId) ?? templateGallery[0];
  const previewScale = PREVIEW_DISPLAY_WIDTH / selectedTemplate.canvas.width;

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
    const parsed = createCampaignSchema.safeParse({ slug: slug.trim(), templateId });
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
        templateId: parsed.data.templateId,
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

        <Form.Item label="Mẫu khung">
          <TemplateGallery templates={templateGallery} selectedId={templateId} onSelect={setTemplateId} />
        </Form.Item>

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

        {backgroundPreviewUrl && (
          <Card title="Xem trước" size="small" className="mb-6">
            <div
              className="relative overflow-hidden rounded border border-slate-200"
              style={{ width: PREVIEW_DISPLAY_WIDTH, height: selectedTemplate.canvas.height * previewScale }}
            >
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <div
                  className="relative"
                  style={{ width: selectedTemplate.canvas.width, height: selectedTemplate.canvas.height }}
                >
                  <PrintArea
                    isDevMod
                    template={{ ...selectedTemplate, background: backgroundPreviewUrl }}
                    content={{}}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        <Button type="primary" htmlType="submit" block loading={isSubmitting}>
          Tạo chiến dịch
        </Button>
      </Form>
    </OwnerLayout>
  );
}
