/**
 * Pixel sizes for the Tailwind text-size utility classes Name.tsx/Role.tsx/
 * Message.tsx use in their non-`autoFit` two-tier fallback (`text-xl`,
 * `text-3xl`, `text-5xl`) — tailwind.config.js doesn't override `fontSize`,
 * so these are Tailwind's own default scale (rem values × the browser's
 * 16px root), hardcoded here since Konva.Text needs an explicit px number
 * rather than a class name.
 */
export const TEXT_XL_PX = 20; // 1.25rem
export const TEXT_3XL_PX = 30; // 1.875rem
export const TEXT_5XL_PX = 48; // 3rem
