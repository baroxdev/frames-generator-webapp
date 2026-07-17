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

export const createCampaignSchema = z.object({
  slug: slugField,
  templateId: z.string().min(1, 'Vui lòng chọn một mẫu khung'),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
