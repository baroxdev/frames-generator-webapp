import { z } from 'zod';

// Mirrors the `campaigns_slug_format` check constraint in
// `supabase/migrations/0001_campaigns.sql` — kept in sync by hand since the
// two run in different languages. Slugs are used as URL path segments
// (`/<slug>`), so only lowercase letters, digits, and single hyphens between
// segments are allowed (no leading/trailing/double hyphens).
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugField = z
  .string()
  .trim()
  .min(3, 'Đường dẫn cần có ít nhất 3 ký tự')
  .max(50, 'Đường dẫn tối đa 50 ký tự')
  .regex(SLUG_PATTERN, 'Đường dẫn chỉ được chứa chữ thường, số và dấu gạch ngang');

// Mirrors `Box`/`AvatarBoxConfig`/`TextBoxConfig` in `src/templates/types.ts`.
// `shape` is restricted to 'circle' | 'square' here (narrower than that
// type's full `AvatarShape` union) because this schema only validates what
// the free-form layout editor can produce for a *new* campaign — 'diamond'
// still exists on old, pre-editor rows, but isn't offered as a new choice
// (see docs/specs/free-form-layout-editor.md).
const boxSchema = z.object({
  top: z.number().min(0, 'Vị trí không được nằm ngoài khung ảnh'),
  left: z.number().min(0, 'Vị trí không được nằm ngoài khung ảnh'),
  width: z.number().positive('Kích thước phải lớn hơn 0'),
  height: z.number().positive('Kích thước phải lớn hơn 0'),
});

const avatarBoxSchema = boxSchema.extend({
  shape: z.enum(['circle', 'square']),
});

const textBoxSchema = boxSchema.extend({
  shrinkAt: z.number().positive().optional(),
  textColor: z.string().min(1, 'Vui lòng chọn màu chữ'),
});

export const campaignLayoutSchema = z.object({
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  avatarBox: avatarBoxSchema,
  nameBox: textBoxSchema,
  roleBox: textBoxSchema,
  messageBox: textBoxSchema,
});

export const createCampaignSchema = z.object({
  slug: slugField,
  layout: campaignLayoutSchema,
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CampaignLayoutInput = z.infer<typeof campaignLayoutSchema>;
