/**
 * A Template describes one visually distinct frame layout: a background image
 * plus the coordinate/config schema for the four boxes that get filled in
 * with a submission's data (avatar, name, role, message).
 *
 * This is the seam that used to be hardcoded pixel values inside
 * `PrintArea.tsx` (and, separately, inline JSX in `App.tsx`). Every layout
 * concern lives here now; the rendering components stay generic and simply
 * draw whatever box they're given.
 */

/** Avatar crop shape a template can request from the Avatar component. */
export type AvatarShape = 'circle' | 'diamond' | 'square';

/**
 * A single box on the canvas.
 *
 * `top`/`left`/`width`/`height` are plain pixel offsets against the
 * template's `canvas` size, in the same units PrintArea has always rendered
 * at (the canvas is captured 1:1 by the compositor, unscaled).
 */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

/** Box config for the avatar photo. */
export interface AvatarBoxConfig extends Box {
  shape: AvatarShape;
  /**
   * A single straight (horizontal or vertical) crop cut through the circle
   * — a half-moon/D-shape crop, not a pie slice out of the middle — only
   * meaningful when `shape === 'circle'`. Omit (leave `clipAxis` unset) for
   * a full circle — today's default behavior, unchanged.
   *
   * `clipRatio` (0-1) is the cut line's position: for `horizontal`, `0`
   * puts the line at the circle's top edge and `1` at its bottom edge
   * (`0.5` = exactly through the center, a true half-circle); for
   * `vertical`, `0` is the left edge and `1` the right edge. Defaults to
   * `0.5` when `clipAxis` is set but `clipRatio` is omitted.
   *
   * `clipKeepEnd` picks which side of that line survives — for
   * `horizontal`, `false` (default) keeps the top, `true` keeps the
   * bottom; for `vertical`, `false` keeps the left, `true` keeps the
   * right. See `src/utils/circleClip.ts`.
   */
  clipAxis?: 'horizontal' | 'vertical';
  clipRatio?: number;
  clipKeepEnd?: boolean;
}

/** Box config for a text field (name, role, message). */
export interface TextBoxConfig extends Box {
  /** Character count above which the component should shrink its font size. */
  shrinkAt?: number;
  /** CSS color for the text. Defaults are preserved per-component when omitted. */
  textColor?: string;
  /**
   * Opt-in continuous auto-fit sizing (binary-searches the largest font
   * size that fits the box's own width/height and the content's character
   * count — see `src/utils/fitTextToBox.ts`), replacing the two-tier
   * `shrinkAt` behavior below. Only ever set by the free-form layout
   * editor's generated/edited campaigns — omitted (falsy) on every
   * pre-existing template/row, which keeps rendering the exact `shrinkAt`
   * behavior unchanged. Never both: a box either auto-fits or uses
   * `shrinkAt`, not some mix of the two.
   */
  autoFit?: boolean;
}

/** Font file formats accepted for a campaign owner's own uploaded font (see `CustomFont`). */
export type CustomFontFormat = 'woff2' | 'truetype' | 'opentype';

/**
 * A campaign owner's own uploaded font file (paid feature — see
 * docs/specs or the campaign schema for gating, if/when added), as opposed
 * to picking one of the curated Google Fonts in `src/constants/fonts.ts`.
 *
 * `family` is a synthetic, per-upload CSS `font-family` name (never
 * user-supplied raw text — see `src/utils/customFont.ts`) and is always
 * kept equal to the owning `Template`/`CampaignLayout`'s own `fontFamily`
 * field, so every other seam that already reads `fontFamily` (rendering,
 * resolveTemplate, the export pipeline) keeps working unchanged; `customFont`
 * only adds the extra information (`url`/`format`) needed to actually load
 * that family's glyphs, since it isn't a Google Fonts family Google's CSS2
 * endpoint can resolve.
 */
export interface CustomFont {
  family: string;
  url: string;
  format: CustomFontFormat;
  /** Original uploaded filename, shown back to the owner in the layout editor. */
  originalFileName: string;
}

export interface Template {
  id: string;
  /** Human-readable name shown in the template gallery. */
  name: string;
  /** Short description of the visual style, shown in the template gallery. */
  description: string;
  /** Background image for the canvas (also doubles as the gallery thumbnail). */
  background: string;
  canvas: CanvasSize;
  avatarBox: AvatarBoxConfig;
  nameBox: TextBoxConfig;
  roleBox: TextBoxConfig;
  messageBox: TextBoxConfig;
  /**
   * Google Fonts family name applied to name/role/message text (one font for
   * all three fields — see `src/constants/fonts.ts` for the curated,
   * Vietnamese-diacritic-supporting list a campaign owner picks from).
   * Omit to fall back to `DEFAULT_FONT_FAMILY`. When `customFont` is set,
   * this holds `customFont.family` instead of a curated family name.
   */
  fontFamily?: string;
  /** Set when `fontFamily` is the owner's own uploaded font rather than a curated Google Font. */
  customFont?: CustomFont;
  /**
   * When true, the visitor-submitted name/role render with a fixed prefix
   * prepended — "Họ và tên: " for name, "Đơn vị: " for role (see
   * `src/constants/fieldPrefixes.ts`). One shared toggle for both fields
   * rather than a separate flag per box, matching how the layout editor
   * exposes it: a single switch, not per-box text a caller could set to
   * anything. Omit (falsy) to render the raw submitted text unchanged —
   * the pre-existing behavior every template/campaign had before this.
   */
  showFieldPrefix?: boolean;
}

/** The submission data a template gets rendered with. */
export interface FrameContent {
  avatar?: string;
  fullName?: string;
  role?: string;
  message?: string;
}

/**
 * A campaign's own free-form box layout (ticket: free-form layout editor)
 * — structurally identical to `Template` minus the fields that only make
 * sense for a shared, named gallery entry (`id`, `name`, `description`,
 * `background`). A campaign's background lives on the campaign row itself
 * (`background_image_url`), not inside its layout.
 */
export type CampaignLayout = Pick<
  Template,
  | 'canvas'
  | 'avatarBox'
  | 'nameBox'
  | 'roleBox'
  | 'messageBox'
  | 'fontFamily'
  | 'customFont'
  | 'showFieldPrefix'
>;
