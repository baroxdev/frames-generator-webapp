import { LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, Upload } from "antd";
import ImgCrop from "antd-img-crop";
import { useEffect, useRef, useState } from "react";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "../auth/TurnstileWidget";
import { type SubmissionInput } from "../../schemas/submission.schema";
import { Controller, type UseFormReturn } from "react-hook-form";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const TURNSTILE_ACTION = "submit-tribute";

export type TributeSubmitValues = SubmissionInput;

type TributeFormProps = {
  turnstileSiteKey: string;
  isSubmitting: boolean;
  form: UseFormReturn<TributeSubmitValues>;
  onSubmit: (values: TributeSubmitValues) => Promise<void>;
};

export function TributeForm({
  turnstileSiteKey,
  isSubmitting,
  onSubmit,
  form,
}: TributeFormProps) {
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const avatarFile = form.watch("avatar.file");

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch {
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
          </Form.Item>
        )}
      />

      <p className="-mt-2 mb-4 text-xs text-gray-500">
        Bằng việc gửi, bạn đồng ý cho phép chiến dịch sử dụng ảnh và thông tin
        này để tạo khung ảnh tri ân công khai.
      </p>

      <Button type="primary" htmlType="submit" block loading={isSubmitting}>
        Gửi thông điệp
      </Button>
    </Form>
  );
}
