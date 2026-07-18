import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Upload, type UploadProps } from 'antd';
import ImgCrop from 'antd-img-crop';
import { useEffect, useRef, useState } from 'react';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../auth/TurnstileWidget';
import { submissionSchema, type SubmissionInput } from '../../schemas/submission.schema';
import { fieldErrorsFromZod } from '../../utils/zod-errors';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TURNSTILE_ACTION = 'submit-tribute';

export type TributeSubmitValues = SubmissionInput & { avatarFile: File; turnstileToken: string };

type FieldErrors = Partial<Record<keyof SubmissionInput, string>> & { avatar?: string; turnstile?: string };

type TributeFormProps = {
  turnstileSiteKey: string;
  isSubmitting: boolean;
  /** Rejecting signals a failed submit — the form resets its (single-use) Turnstile token so the visitor can retry without a confusing silent failure. */
  onSubmit: (values: TributeSubmitValues) => Promise<void>;
};

/**
 * The visitor-facing tribute submission form: avatar (crop to a square,
 * matching legacy App.tsx's `antd-img-crop` + `Upload` pattern), full name,
 * role/unit, message, a Turnstile challenge, and a one-line consent notice
 * next to the submit action — the ticket #6 acceptance criteria in form
 * order. Owns all of its own field state so `CampaignPublicPage` only needs
 * to know about the final submitted values.
 *
 * `avatarFile` is only ever used to render into the visitor's live template
 * preview for compositing — it is never uploaded on its own. Only the final
 * composited frame (background + this avatar + the text fields below,
 * produced by `frameCompositor.service.ts`) gets uploaded to R2.
 */
export function TributeForm({ turnstileSiteKey, isSubmitting, onSubmit }: TributeFormProps) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleAvatarChange: UploadProps['onChange'] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;
    setAvatarFile(file ?? null);
  };

  const handleSubmit = async () => {
    const parsed = submissionSchema.safeParse({ fullName, role, message });
    const fieldErrors: FieldErrors = parsed.success ? {} : fieldErrorsFromZod<keyof SubmissionInput>(parsed.error);
    if (!avatarFile) {
      fieldErrors.avatar = 'Vui lòng thêm ảnh đại diện';
    }
    if (!turnstileToken) {
      fieldErrors.turnstile = 'Vui lòng xác thực CAPTCHA';
    }
    if (!parsed.success || !avatarFile || !turnstileToken || Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      await onSubmit({ ...parsed.data, avatarFile, turnstileToken });
    } catch {
      // Turnstile tokens are single-use — without resetting, a retry would
      // silently resend the already-consumed token (see SignUpPage's
      // identical handling of the same constraint).
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

  return (
    <Form layout="vertical" onFinish={handleSubmit} noValidate>
      <Form.Item label="Ảnh đại diện" validateStatus={errors.avatar ? 'error' : ''} help={errors.avatar}>
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
            listType="picture-circle"
            maxCount={1}
            showUploadList={false}
            accept={ALLOWED_AVATAR_TYPES.join(',')}
            beforeUpload={(file) => {
              if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
                setErrors((previous) => ({ ...previous, avatar: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP' }));
                return Upload.LIST_IGNORE;
              }
              setErrors((previous) => ({ ...previous, avatar: undefined }));
              return false;
            }}
            onChange={handleAvatarChange}
          >
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Ảnh đại diện" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div>{isSubmitting ? <LoadingOutlined /> : <PlusOutlined />}</div>
            )}
          </Upload>
        </ImgCrop>
      </Form.Item>

      <Form.Item label="Họ và tên" validateStatus={errors.fullName ? 'error' : ''} help={errors.fullName}>
        <Input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={25} aria-label="Họ và tên" />
      </Form.Item>

      <Form.Item label="Đơn vị" validateStatus={errors.role ? 'error' : ''} help={errors.role}>
        <Input value={role} onChange={(event) => setRole(event.target.value)} maxLength={36} aria-label="Đơn vị" />
      </Form.Item>

      <Form.Item label="Thông điệp" validateStatus={errors.message ? 'error' : ''} help={errors.message}>
        <Input.TextArea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={400}
          aria-label="Thông điệp"
        />
      </Form.Item>

      <Form.Item validateStatus={errors.turnstile ? 'error' : ''} help={errors.turnstile}>
        <TurnstileWidget
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          action={TURNSTILE_ACTION}
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
        />
      </Form.Item>

      <p className="-mt-2 mb-4 text-xs text-gray-500">
        Bằng việc gửi, bạn đồng ý cho phép chiến dịch sử dụng ảnh và thông tin này để tạo khung ảnh tri ân công khai.
      </p>

      <Button type="primary" htmlType="submit" block loading={isSubmitting}>
        Gửi thông điệp
      </Button>
    </Form>
  );
}
