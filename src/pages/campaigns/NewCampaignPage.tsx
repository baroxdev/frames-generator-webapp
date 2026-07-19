import {
  DeleteOutlined,
  InboxOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  Upload,
  message,
  type UploadFile,
  type UploadProps,
} from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useDebounce } from "use-debounce";
import { LayoutEditor } from "../../components/campaigns/LayoutEditor";
import { OwnerLayout } from "../../components/owner/OwnerLayout";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  campaignKeys,
  createCampaignMutationOptions,
  slugAvailabilityQueryOptions,
  uploadCampaignBackgroundMutationOptions,
  uploadCampaignHeaderMutationOptions,
} from "../../queries/campaign.queries";
import type { CreateCampaignParams } from "../../services/campaign.service";
import {
  createCampaignSchema,
  slugField,
  type CreateCampaignInput,
} from "../../schemas/campaign.schema";
import { getDefaultCampaignLayout, type CampaignLayout } from "../../templates";
import { getImageDimensions } from "../../utils/get-image-dimensions";
import { reportCampaignError } from "../../utils/report-campaign-error";
import { fieldErrorsFromZod } from "../../utils/zod-errors";

const ALLOWED_BACKGROUND_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SLUG_DEBOUNCE_MS = 400;

type FieldErrors = Partial<Record<keyof CreateCampaignInput, string>> & {
  backgroundImage?: string;
};

export function NewCampaignPage() {
  const { user, isLoading } = useAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundFileList, setBackgroundFileList] = useState<UploadFile[]>(
    [],
  );
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<
    string | null
  >(null);
  const [layout, setLayout] = useState<CampaignLayout | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailFileList, setThumbnailFileList] = useState<UploadFile[]>([]);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerFileList, setHeaderFileList] = useState<UploadFile[]>([]);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [debouncedSlug] = useDebounce(slug.trim(), SLUG_DEBOUNCE_MS);

  const uploadMutation = useMutation(uploadCampaignBackgroundMutationOptions());
  // Same underlying upload (a generic "put this image in R2" call) as the
  // background — a thumbnail is just another campaign image, no need for a
  // dedicated service method.
  const thumbnailUploadMutation = useMutation(
    uploadCampaignBackgroundMutationOptions(),
  );
  const headerUploadMutation = useMutation(
    uploadCampaignHeaderMutationOptions(),
  );
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
          setErrors((previous) => ({
            ...previous,
            backgroundImage: "Không thể đọc kích thước ảnh nền.",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [backgroundFile]);

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

  if (isLoading) {
    return (
      <OwnerLayout title="Tạo chiến dịch mới" hideSider>
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleBackgroundChange: UploadProps["onChange"] = (info) => {
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
      setErrors((previous) => ({
        ...previous,
        backgroundImage: "Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP",
      }));
      setBackgroundFileList([]);
      setBackgroundFile(null);
      return;
    }
    setErrors((previous) => ({ ...previous, backgroundImage: undefined }));
    setBackgroundFileList(latest);
    setBackgroundFile(file);
  };

  const handleThumbnailChange: UploadProps["onChange"] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file || !ALLOWED_BACKGROUND_TYPES.includes(file.type)) {
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

  const handleHeaderChange: UploadProps["onChange"] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file || !ALLOWED_BACKGROUND_TYPES.includes(file.type)) {
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
    uploadMutation.isPending ||
    thumbnailUploadMutation.isPending ||
    headerUploadMutation.isPending ||
    createMutation.isPending;

  const handleSubmit = async () => {
    const parsed = createCampaignSchema.safeParse({
      slug: slug.trim(),
      layout,
      title: title.trim(),
      description: description.trim(),
    });
    const fieldErrors: FieldErrors = parsed.success
      ? {}
      : fieldErrorsFromZod<keyof CreateCampaignInput>(parsed.error);
    if (!backgroundFile) {
      fieldErrors.backgroundImage = "Vui lòng tải ảnh nền lên";
    }
    if (
      parsed.success &&
      slugFormatValid &&
      slugAvailabilityQuery.data === false
    ) {
      fieldErrors.slug =
        "Đường dẫn này đã được sử dụng. Vui lòng chọn đường dẫn khác.";
    }
    if (
      !parsed.success ||
      !backgroundFile ||
      Object.keys(fieldErrors).length > 0
    ) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      const backgroundImageUrl =
        await uploadMutation.mutateAsync(backgroundFile);
      const thumbnailUrl = thumbnailFile
        ? await thumbnailUploadMutation.mutateAsync(thumbnailFile)
        : undefined;
      const headerImageUrl = headerFile
        ? await headerUploadMutation.mutateAsync(headerFile)
        : undefined;

      const createParams: CreateCampaignParams = {
        slug: parsed.data.slug,
        layout: parsed.data.layout,
        backgroundImageUrl,
        // Omitted entirely when blank rather than sent as an empty string —
        // campaign.service.ts treats a missing key the same as `null`
        // (falls back at read time via resolveCampaignSeo.ts), so there's
        // no reason to send an empty string over the wire.
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.description && {
          description: parsed.data.description,
        }),
        ...(thumbnailUrl && { thumbnailUrl }),
        ...(headerImageUrl && { headerImageUrl }),
      };
      await createMutation.mutateAsync(createParams);
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      message.success(
        "Chiến dịch đã được tạo và đang chờ duyệt. Đường dẫn sẽ chưa công khai cho đến khi được duyệt.",
      );
      navigate({ to: "/campaigns" });
    } catch (error) {
      reportCampaignError(error, "Không thể tạo chiến dịch. Vui lòng thử lại.");
    }
  };

  return (
    <OwnerLayout title="Tạo chiến dịch mới" hideSider>
      <Form
        layout="vertical"
        onFinish={handleSubmit}
        noValidate
        className="flex h-full w-full flex-col gap-4"
      >
        <div className="flex h-full overflow-hidden">
          <div
            data-slot="left-panel"
            className="w-[260px] bg-white h-full shrink-0 overflow-y-auto border-r p-4 flex flex-col gap-6"
          >
            {/* Đường dẫn — the only "settings" field that isn't a layer on
                the canvas itself (unlike the background, see the canvas
                pane below). */}
            <div>
              <Form.Item
                label="Đường dẫn"
                validateStatus={errors.slug ? "error" : ""}
                help={errors.slug}
                className="!mb-1"
              >
                <Input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="dai-hoi-ben-tre"
                  aria-label="Đường dẫn"
                />
              </Form.Item>
              {!errors.slug &&
                slugFormatValid &&
                slugAvailabilityQuery.data === true && (
                  <p className="text-xs text-green-600">Đường dẫn khả dụng</p>
                )}
              {!errors.slug &&
                slugFormatValid &&
                slugAvailabilityQuery.data === false && (
                  <p className="text-xs text-red-600">
                    Đường dẫn này đã được sử dụng
                  </p>
                )}
            </div>

            {/* Trang chiến dịch — page-level metadata (SEO title/description,
                thumbnail, public-page header banner). None of it affects the
                canvas above, so it's grouped as its own layer rather than
                mixed into the background/slug controls. */}
            <div className="flex flex-col gap-4 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-700">
                Trang chiến dịch (không bắt buộc)
              </h4>

              <Form.Item
                label="Tiêu đề"
                validateStatus={errors.title ? "error" : ""}
                help={errors.title}
                className="!mb-0"
              >
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025"
                  aria-label="Tiêu đề"
                  maxLength={100}
                />
              </Form.Item>
              <Form.Item
                label="Mô tả"
                validateStatus={errors.description ? "error" : ""}
                help={errors.description}
                className="!mb-0"
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

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Ảnh thu nhỏ
                </p>
                {thumbnailPreviewUrl ? (
                  <div className="relative">
                    <img
                      src={thumbnailPreviewUrl}
                      alt=""
                      className="aspect-square w-full rounded border border-slate-200 object-cover"
                    />
                    <Button
                      shape="circle"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="Xoá ảnh thu nhỏ"
                      onClick={handleThumbnailRemove}
                      className="!absolute !right-1.5 !top-1.5 !bg-white shadow"
                    />
                  </div>
                ) : (
                  <Upload
                    accept={ALLOWED_BACKGROUND_TYPES.join(",")}
                    showUploadList={false}
                    maxCount={1}
                    fileList={thumbnailFileList}
                    beforeUpload={() => false}
                    onChange={handleThumbnailChange}
                    onRemove={handleThumbnailRemove}
                  >
                    <Button block>Chọn ảnh</Button>
                  </Upload>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Mặc định dùng ảnh nền nếu không chọn.
                </p>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  Ảnh bìa trang chiến dịch
                </p>
                <p className="mb-2 text-xs text-slate-500">
                  Hiển thị ở đầu trang công khai. Chấp nhận mọi tỷ lệ ảnh.
                </p>
                {headerPreviewUrl ? (
                  <div className="relative">
                    <img
                      src={headerPreviewUrl}
                      alt=""
                      className="w-full rounded border border-slate-200"
                    />
                    <Button
                      shape="circle"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="Xoá ảnh bìa"
                      onClick={handleHeaderRemove}
                      className="!absolute !right-1.5 !top-1.5 !bg-white shadow"
                    />
                  </div>
                ) : (
                  <Upload
                    accept={ALLOWED_BACKGROUND_TYPES.join(",")}
                    showUploadList={false}
                    maxCount={1}
                    fileList={headerFileList}
                    beforeUpload={() => false}
                    onChange={handleHeaderChange}
                    onRemove={handleHeaderRemove}
                  >
                    <Button block>Tải ảnh bìa lên</Button>
                  </Upload>
                )}
              </div>
            </div>
          </div>
          <div
            data-slot="canvas"
            className="relative h-full min-w-0 flex-1 overflow-auto p-4"
          >
            {backgroundPreviewUrl && layout ? (
              <>
                <LayoutEditor
                  layout={layout}
                  backgroundImageUrl={backgroundPreviewUrl}
                  onChange={setLayout}
                />
                {/* Background is a canvas layer, not a sidebar setting — so
                    "change it" lives as a floating control over the canvas
                    itself, same as Figma/Canva's image-fill controls. */}
                <Upload
                  accept={ALLOWED_BACKGROUND_TYPES.join(",")}
                  maxCount={1}
                  showUploadList={false}
                  fileList={backgroundFileList}
                  beforeUpload={() => false}
                  onChange={handleBackgroundChange}
                  className="absolute left-8 top-8"
                >
                  <Button icon={<PictureOutlined />} className="shadow">
                    Đổi ảnh nền
                  </Button>
                </Upload>
              </>
            ) : (
              <Upload.Dragger
                accept={ALLOWED_BACKGROUND_TYPES.join(",")}
                maxCount={1}
                showUploadList={false}
                fileList={backgroundFileList}
                beforeUpload={() => false}
                onChange={handleBackgroundChange}
                className="!h-64 !bg-white"
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Kéo thả ảnh vào đây, hoặc bấm để chọn ảnh nền
                </p>
                <p className="ant-upload-hint">
                  Chấp nhận JPEG, PNG hoặc WEBP
                </p>
              </Upload.Dragger>
            )}
            {errors.backgroundImage && (
              <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded bg-red-50 px-3 py-1 text-xs text-red-600 shadow">
                {errors.backgroundImage}
              </p>
            )}
            <div
              data-slot="bottom-bar"
              className="absolute bottom-8 left-1/2 w-[min(90%,800px)] -translate-x-1/2 rounded-xl bg-white p-1 shadow"
            >
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmitting}
                className="shrink-0"
              >
                Tạo chiến dịch
              </Button>
            </div>
          </div>
        </div>
      </Form>
    </OwnerLayout>
  );
}
