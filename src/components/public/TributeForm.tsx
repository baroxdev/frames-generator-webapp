import {
  DownloadOutlined,
  FacebookOutlined,
  LoadingOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, message, Modal, Upload } from "antd";
import ImgCrop from "antd-img-crop";
import { useEffect, useRef, useState } from "react";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "../auth/TurnstileWidget";
import { type SubmissionInput } from "../../schemas/submission.schema";
import { Controller, type UseFormReturn } from "react-hook-form";
import { loadFacebookSdk, openShareDialog } from "../../lib/facebookSdk";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const TURNSTILE_ACTION = "submit-tribute";
const RESULT_IMAGE_FILENAME = "khung-anh-tri-an.jpg";

export type TributeSubmitValues = SubmissionInput;

type TributeFormProps = {
  turnstileSiteKey: string;
  facebookAppId: string;
  shareUrl: string;
  isSubmitting: boolean;
  form: UseFormReturn<TributeSubmitValues>;
  onSubmit: (values: TributeSubmitValues) => Promise<void>;
  metadata?: {
    resultImage: string | null;
  } & Record<string, unknown>;
};

export function TributeForm({
  turnstileSiteKey,
  facebookAppId,
  shareUrl,
  isSubmitting,
  onSubmit,
  form,
  metadata,
}: TributeFormProps) {
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const avatarFile = form.watch("avatar.file");
  const resultImage = metadata?.resultImage;
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // Warms the Facebook SDK ahead of time so that when the visitor clicks
  // "Chia sẻ Facebook" in the result dialog, FB.ui() can be called
  // synchronously within the click handler — see facebookSdk.ts for why
  // that matters for the popup not getting blocked.
  useEffect(() => {
    loadFacebookSdk(facebookAppId);
  }, [facebookAppId]);

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
    } catch (error) {
      console.error("Failed to download result image", error);
      message.error("Không thể tải ảnh xuống. Vui lòng thử lại.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareFacebook = () => {
    openShareDialog(facebookAppId, shareUrl);
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
              <ImgCrop
                aspect={1}
                cropShape="round"
                showGrid
                rotationSlider
                showReset
                resetText="Đặt lại"
                modalCancel="Hủy"
                modalOk="Xác nhận"
                modalTitle="Chỉnh sửa ảnh đại diện"
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
                    return false;
                  }}
                  onChange={(info) => {
                    const latest = info.fileList.slice(-1);
                    const file = latest[0]?.originFileObj as File | undefined;
                    field.onChange(file ?? null);
                  }}
                >
                  {avatarPreviewUrl ? (
                    <img
                      src={avatarPreviewUrl}
                      alt="Ảnh đại diện"
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div>
                      {isSubmitting ? <LoadingOutlined /> : <PlusOutlined />}
                    </div>
                  )}
                </Upload>
              </ImgCrop>
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
            <Input {...field} maxLength={25} aria-label="Họ và tên" />
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
            <Input {...field} maxLength={25} aria-label="Đơn vị / Chức vụ" />
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
              rows={4}
              maxLength={400}
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
              Gửi thông điệp
            </Button>
            <Button
              type="default"
              className="w-2/6"
              block
              disabled={isSubmitting || !resultImage}
              icon={<DownloadOutlined />}
              onClick={() => setIsResultModalOpen(true)}
            >
              Tải về
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={isResultModalOpen}
        onCancel={() => setIsResultModalOpen(false)}
        footer={null}
        title="Ảnh khung tri ân của bạn"
        centered
      >
        {resultImage && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={resultImage}
              alt="Khung ảnh tri ân"
              className="w-full rounded-lg"
            />
            <div className="flex w-full items-center gap-3">
              <Button
                block
                icon={<DownloadOutlined />}
                loading={isDownloading}
                onClick={handleDownload}
              >
                Tải về máy
              </Button>
              <Button
                block
                icon={<FacebookOutlined />}
                onClick={handleShareFacebook}
              >
                Chia sẻ Facebook
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Form>
  );
}
