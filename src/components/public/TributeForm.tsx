import {
  DownloadOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, message, Modal, Upload } from "antd";
import ImgCrop from "antd-img-crop";
import { useEffect, useRef, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { type SubmissionInput } from "../../schemas/submission.schema";
import { Campaign } from "../../services/campaign.service";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "../auth/TurnstileWidget";
import { config } from "../../config";
import { trackEvent } from "../../lib/analytics";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const TURNSTILE_ACTION = "submit-tribute";
const RESULT_IMAGE_FILENAME = "khung-anh-tri-an.jpg";

export type TributeSubmitValues = SubmissionInput;

type TributeFormProps = {
  turnstileSiteKey: string;
  isSubmitting: boolean;
  form: UseFormReturn<TributeSubmitValues>;
  onSubmit: (values: TributeSubmitValues) => Promise<void>;
  onResultModalClose?: () => void;
  metadata?: {
    resultImage: string | null;
    campaign: Campaign | null;
  } & Record<string, unknown>;
};

export function TributeForm({
  turnstileSiteKey,
  isSubmitting,
  onSubmit,
  onResultModalClose,
  form,
  metadata,
}: TributeFormProps) {
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  // The pre-crop photo, captured via ImgCrop's `beforeCrop` — kept so the
  // recrop button can reopen the crop modal on the original framing instead
  // of re-cropping an already-cropped (and thus lower-quality, re-centered)
  // image.
  const originalAvatarFileRef = useRef<File | null>(null);
  const avatarFile = form.watch("avatar.file");
  const resultImage = metadata?.resultImage;
  // Matches the crop tool's aspect ratio to the campaign's actual avatar
  // box (frequently not square — e.g. the default template's 286x260)
  // instead of a hardcoded 1:1. Avatar.tsx renders the cropped photo with
  // `object-cover`, which silently re-crops (recentering on whatever the
  // visitor framed) anything whose aspect ratio doesn't already match the
  // box — so a mismatched crop aspect here is what makes the visitor's
  // manual pan/zoom get discarded in the final composited frame.
  const avatarBox = metadata?.campaign?.layout.avatarBox;
  const avatarCropAspect = avatarBox ? avatarBox.width / avatarBox.height : 1;
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // Once a submission produces a result image, surface it straight away in
  // the share/download dialog instead of leaving the visitor to notice the
  // now-enabled footer button themselves.
  useEffect(() => {
    if (resultImage) {
      setIsResultModalOpen(true);
    }
  }, [resultImage]);

  // The result image is served from R2, a different origin than this app,
  // and browsers ignore the `download` attribute on cross-origin links —
  // they navigate to the image instead of saving it. Fetching it and
  // downloading a same-origin blob URL forces an actual save.
  const handleDownload = async () => {
    if (!resultImage) return;

    setIsDownloading(true);
    try {
      const response = await fetch(resultImage, {
        method: "GET",
        mode: "cors",
        cache: "no-cache",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch result image: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = RESULT_IMAGE_FILENAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      trackEvent("tribute_image_download", {
        campaign_id: metadata?.campaign?.id,
        owner_id: metadata?.campaign?.ownerId,
      });
    } catch (error) {
      console.error("Failed to download result image", error);
      message.error("Không thể tải ảnh xuống. Vui lòng thử lại.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Re-selecting the same File object through a real OS file dialog doesn't
  // fire a `change` event, so we drive the hidden input's file list directly
  // via DataTransfer and dispatch the event ourselves — this re-enters
  // ImgCrop's beforeUpload pipeline exactly as if the visitor had picked the
  // photo again, reopening the crop modal on it.
  const handleRecrop = () => {
    const input =
      avatarContainerRef.current?.querySelector<HTMLInputElement>(
        'input[type="file"]',
      );
    if (!input) return;

    const original = originalAvatarFileRef.current;
    if (!original) {
      input.click();
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(original);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const handleCloseResultModal = () => {
    setIsResultModalOpen(false);
    form.reset();
    // Turnstile tokens are single-use — the one already consumed by the
    // submission that produced this result must not linger in state, or
    // the next submit attempt silently resends it and gets rejected.
    turnstileRef.current?.reset();
    onResultModalClose?.();
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (e) {
      console.error("TributeForm submission failed", e);
      // Turnstile tokens are single-use — without resetting, a retry would
      // silently resend the already-consumed token.
      turnstileRef.current?.reset();
      form.setValue("turnstileToken", undefined);
      form.setError("turnstileToken", {
        type: "validate",
        message: "Vui lòng xác thực CAPTCHA",
      });
    }
  });

  return (
    <Form layout="vertical" onFinish={handleSubmit} noValidate>
      <Controller
        control={form.control}
        name="avatar.file"
        rules={{ required: "Vui lòng thêm ảnh đại diện" }}
        render={({ field, fieldState }) => {
          return (
            <Form.Item
              label="Ảnh đại diện"
              validateStatus={fieldState.invalid ? "error" : ""}
              help={fieldState.error?.message}
            >
              <div ref={avatarContainerRef} className="relative block">
                <ImgCrop
                  aspect={avatarCropAspect}
                  cropShape="round"
                  showGrid
                  rotationSlider
                  showReset
                  resetText="Đặt lại"
                  modalCancel="Hủy"
                  modalOk="Xác nhận"
                  modalTitle="Chỉnh sửa ảnh đại diện"
                  beforeCrop={(file) => {
                    originalAvatarFileRef.current = file;
                    return true;
                  }}
                >
                  <Upload
                    style={{ width: 120, height: 120 }}
                    listType="picture-circle"
                    maxCount={1}
                    showUploadList={false}
                    accept={ALLOWED_AVATAR_TYPES.join(",")}
                    beforeUpload={(file) => {
                      if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
                        form.setError("avatar.file", {
                          type: "validate",
                          message: "Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP",
                        });
                        return Upload.LIST_IGNORE;
                      }
                      form.clearErrors("avatar.file");
                      return true;
                    }}
                    customRequest={({ file, onSuccess }) => {
                      field.onChange(file as File);
                      onSuccess?.({});
                    }}
                  >
                    {avatarPreviewUrl ? (
                      <>
                        <img
                          src={avatarPreviewUrl}
                          alt="Ảnh đại diện"
                          className="h-full w-full rounded-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRecrop}
                          aria-label="Chỉnh sửa vùng cắt ảnh"
                          className="absolute bottom-[3%] right-[8%] flex h-8 w-8 items-center justify-center rounded-full border border-white bg-blue-600 text-white shadow-md hover:bg-blue-700"
                        >
                          <EditOutlined />
                        </button>
                      </>
                    ) : (
                      <div>
                        {isSubmitting ? <LoadingOutlined /> : <PlusOutlined />}
                      </div>
                    )}
                  </Upload>
                </ImgCrop>
              </div>
            </Form.Item>
          );
        }}
      />

      <Controller
        control={form.control}
        name="fullName"
        render={({ field, fieldState }) => (
          <Form.Item
            label="Họ và tên"
            validateStatus={fieldState.invalid ? "error" : ""}
            help={fieldState.error?.message}
          >
            <Input
              {...field}
              showCount
              maxLength={config.limit.fullName}
              aria-label="Họ và tên"
            />
          </Form.Item>
        )}
      />

      <Controller
        control={form.control}
        name="role"
        render={({ field, fieldState }) => (
          <Form.Item
            label="Đơn vị / Chức vụ"
            validateStatus={fieldState.invalid ? "error" : ""}
            help={fieldState.error?.message}
          >
            <Input
              {...field}
              maxLength={config.limit.role}
              aria-label="Đơn vị / Chức vụ"
              showCount
            />
          </Form.Item>
        )}
      />

      <Controller
        control={form.control}
        name="message"
        render={({ field, fieldState }) => (
          <Form.Item
            label="Thông điệp"
            validateStatus={fieldState.invalid ? "error" : ""}
            help={fieldState.error?.message}
          >
            <Input.TextArea
              {...field}
              showCount
              rows={4}
              maxLength={config.limit.message}
              aria-label="Thông điệp"
            />
          </Form.Item>
        )}
      />
      <Controller
        control={form.control}
        name="turnstileToken"
        rules={{ required: "Vui lòng xác thực CAPTCHA" }}
        render={({ field }) => (
          <Form.Item
            validateStatus={form.formState.errors.turnstileToken ? "error" : ""}
            help={form.formState.errors.turnstileToken?.message}
          >
            <div className="w-full flex items-center justify-center">
              <TurnstileWidget
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                action={TURNSTILE_ACTION}
                onVerify={(token) => {
                  field.onChange(token);
                  form.clearErrors("turnstileToken");
                }}
                onExpire={() => {
                  field.onChange(null);
                  form.setError("turnstileToken", {
                    type: "validate",
                    message: "Vui lòng xác thực CAPTCHA",
                  });
                }}
                onError={() => {
                  field.onChange(null);
                  form.setError("turnstileToken", {
                    type: "validate",
                    message: "Vui lòng xác thực CAPTCHA",
                  });
                }}
              />
            </div>
          </Form.Item>
        )}
      />

      <div className="fixed z-50 bottom-0 left-0 border-t right-0 bg-white p-4">
        <div className=" max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <Button
              type="primary"
              className="w-4/6"
              htmlType="submit"
              block
              loading={isSubmitting}
            >
              Gửi lời tri ân
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={isResultModalOpen}
        onCancel={handleCloseResultModal}
        footer={null}
        title="Ảnh khung tri ân của bạn"
        centered
      >
        {resultImage && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="bg-neutral-200 w-full"
              style={{
                aspectRatio: `${metadata?.campaign?.layout?.canvas?.width ?? 400} / ${metadata?.campaign?.layout?.canvas?.height ?? 400}`,
              }}
            >
              <img
                src={resultImage}
                alt="Khung ảnh tri ân"
                className="w-full"
              />
            </div>
            <div className="flex w-full items-center gap-3">
              <Button
                block
                type="primary"
                icon={<DownloadOutlined />}
                loading={isDownloading}
                onClick={handleDownload}
              >
                Tải về máy
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Form>
  );
}
