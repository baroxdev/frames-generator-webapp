import { InboxOutlined } from '@ant-design/icons';
import { Button, Form, Input, Upload, type UploadFile, type UploadProps } from 'antd';
import { useRef, useState } from 'react';
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
 * The visitor-facing tribute submission form: avatar (drag-and-drop, with
 * thumbnail preview), full name, role/unit, message, a Turnstile challenge,
 * and a one-line consent notice next to the submit action — the ticket #6
 * acceptance criteria in form order. Owns all of its own field state so
 * `CampaignPublicPage` only needs to know about the final submitted values.
 */
export function TributeForm({ turnstileSiteKey, isSubmitting, onSubmit }: TributeFormProps) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleAvatarChange: UploadProps['onChange'] = (info) => {
    const latest = info.fileList.slice(-1);
    const file = latest[0]?.originFileObj as File | undefined;

    if (!file) {
      setAvatarFileList([]);
      setAvatarFile(null);
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setErrors((previous) => ({ ...previous, avatar: 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP' }));
      setAvatarFileList([]);
      setAvatarFile(null);
      return;
    }
    setErrors((previous) => ({ ...previous, avatar: undefined }));
    setAvatarFileList(latest);
    setAvatarFile(file);
  };

  const handleAvatarRemove = () => {
    setAvatarFileList([]);
    setAvatarFile(null);
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
        <Upload.Dragger
          accept={ALLOWED_AVATAR_TYPES.join(',')}
          listType="picture"
          maxCount={1}
          fileList={avatarFileList}
          beforeUpload={() => false}
          onChange={handleAvatarChange}
          onRemove={handleAvatarRemove}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Kéo thả ảnh vào đây, hoặc bấm để chọn ảnh</p>
          <p className="ant-upload-hint">Chấp nhận JPEG, PNG hoặc WEBP</p>
        </Upload.Dragger>
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
