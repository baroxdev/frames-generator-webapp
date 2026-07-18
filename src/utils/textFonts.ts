/**
 * Font strings used to measure/size Name/Role/Message text for auto-fit
 * (`fitTextFontSize` + `measureTextWidth`) — centralized here so the
 * free-form layout editor's preview and the real rendering components
 * (`Name.tsx`/`Role.tsx`/`Message.tsx`) can't drift out of sync. Mirrors
 * `tailwind.config.js`'s `font-sans` (Name/Role) and `Message.tsx`'s own
 * inline `fontFamily` (Message) — kept in sync by hand since neither of
 * those is itself a JS value importable here.
 */
export const NAME_ROLE_FONT_TEMPLATE = '700 {size}px "Playwrite HU", cursive';
export const MESSAGE_FONT_TEMPLATE = '500 {size}px "Lobster", cursive';

export function fontAtSize(template: string, sizePx: number): string {
  return template.replace('{size}', String(sizePx));
}
