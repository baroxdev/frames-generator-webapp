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
const canvasSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

const boxSchema = z.object({
  top: z.number().min(0, 'Vị trí không được nằm ngoài khung ảnh'),
  left: z.number().min(0, 'Vị trí không được nằm ngoài khung ảnh'),
  width: z.number().positive('Kích thước phải lớn hơn 0'),
  height: z.number().positive('Kích thước phải lớn hơn 0'),
});

const textBoxSchema = boxSchema.extend({
  shrinkAt: z.number().positive().optional(),
  textColor: z.string().min(1, 'Vui lòng chọn màu chữ'),
  // See TextBoxConfig.autoFit in src/templates/types.ts — mutually
  // exclusive with shrinkAt in practice, but both stay optional here since
  // nothing enforces that exclusivity at the type level either.
  autoFit: z.boolean().optional(),
});

/** Every box must stay fully inside the campaign's own canvas (decided: clamp to canvas, see docs/specs/free-form-layout-editor.md). */
function checkBoxWithinCanvas(
  ctx: z.RefinementCtx,
  path: string,
  box: { top: number; left: number; width: number; height: number },
  canvas: { width: number; height: number },
) {
  if (box.top + box.height > canvas.height || box.left + box.width > canvas.width) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: 'Vị trí không được nằm ngoài khung ảnh' });
  }
}

/**
 * `shape` is restricted to 'circle' | 'square' here (narrower than
 * `AvatarShape`'s full union) because this validates what the free-form
 * layout editor can produce for a *new or edited* campaign — 'diamond'
 * isn't offered as a choice in this flow (see
 * docs/specs/free-form-layout-editor.md), even though it still exists on
 * old, pre-editor rows (see `campaignLayoutRowSchema` below, used for those).
 */
// Straight circle-crop cut (see AvatarBoxConfig.clipAxis/clipRatio/clipKeepEnd
// in src/templates/types.ts).
const clipFields = {
  clipAxis: z.enum(['horizontal', 'vertical']).optional(),
  clipRatio: z.number().min(0).max(1).optional(),
  clipKeepEnd: z.boolean().optional(),
};

// Not validated against the curated list (src/constants/fonts.ts) here —
// that list can grow over time, and an unrecognized value already falls
// back safely to DEFAULT_FONT_FAMILY at render time (getCuratedFont).
const fontFamilyField = z.string().min(1).optional();

export const campaignLayoutSchema = z
  .object({
    canvas: canvasSchema,
    avatarBox: boxSchema.extend({
      shape: z.enum(['circle', 'square']),
      ...clipFields,
    }),
    nameBox: textBoxSchema,
    roleBox: textBoxSchema,
    messageBox: textBoxSchema,
    fontFamily: fontFamilyField,
  })
  .superRefine((layout, ctx) => {
    checkBoxWithinCanvas(ctx, 'avatarBox', layout.avatarBox, layout.canvas);
    checkBoxWithinCanvas(ctx, 'nameBox', layout.nameBox, layout.canvas);
    checkBoxWithinCanvas(ctx, 'roleBox', layout.roleBox, layout.canvas);
    checkBoxWithinCanvas(ctx, 'messageBox', layout.messageBox, layout.canvas);
  });

/**
 * Validates a `layout` read back from the `campaigns` table (any row,
 * including ones created before this editor existed) — permissive on
 * avatar shape (`diamond` included) where `campaignLayoutSchema` above is
 * deliberately narrower for what a *new* submission can contain.
 */
export const campaignLayoutRowSchema = z.object({
  canvas: canvasSchema,
  avatarBox: boxSchema.extend({
    shape: z.enum(['circle', 'square', 'diamond']),
    ...clipFields,
  }),
  nameBox: textBoxSchema,
  roleBox: textBoxSchema,
  messageBox: textBoxSchema,
  fontFamily: fontFamilyField,
});

// Mirrors campaigns_title_length / campaigns_description_length in
// 0006_campaign_seo_fields.sql — kept in sync by hand, same pattern as
// SLUG_PATTERN above. Both optional: an owner who skips them gets the
// fallbacks in resolveCampaignSeo.ts instead.
export const campaignSeoSchema = z.object({
  title: z.string().trim().max(100, 'Tiêu đề tối đa 100 ký tự').optional().or(z.literal('')),
  description: z.string().trim().max(300, 'Mô tả tối đa 300 ký tự').optional().or(z.literal('')),
});

export const createCampaignSchema = z.object({
  slug: slugField,
  layout: campaignLayoutSchema,
}).merge(campaignSeoSchema);

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CampaignLayoutInput = z.infer<typeof campaignLayoutSchema>;
export type CampaignSeoInput = z.infer<typeof campaignSeoSchema>;
