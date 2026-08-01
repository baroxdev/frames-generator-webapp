/**
 * Font-string builder used to measure/size Name/Role/Message text for
 * auto-fit (`fitTextFontSize` + `measureTextWidth`) — centralized here so
 * the free-form layout editor's preview and the real rendering components
 * (`Name.tsx`/`Role.tsx`/`Message.tsx`) can't drift out of sync on font
 * *weight*. The font *family* itself is no longer fixed here — it's the
 * campaign's own `layout.fontFamily` (see `src/constants/fonts.ts`), passed
 * in by the caller — since a campaign owner can now pick from a curated
 * list rather than every campaign sharing one hardcoded font.
 */
export const NAME_ROLE_FONT_WEIGHT = 700;
export const MESSAGE_FONT_WEIGHT = 500;

/** Builds a CSS `font` shorthand string for text measurement — `fontFamily` should already be a full CSS value (e.g. from `cssFontFamily()`), quoted and with its own fallback. */
export function buildFontString(weight: number, sizePx: number, fontFamily: string): string {
  return `${weight} ${sizePx}px ${fontFamily}`;
}
