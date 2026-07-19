import type { CustomFontFormat } from '../templates/types';

/**
 * Client-side rules for a campaign owner's own uploaded font file — kept
 * separate from `src/constants/fonts.ts` (the curated Google Fonts list)
 * since a custom upload has no metadata to look up, only a file to validate
 * and a synthetic `font-family` name to invent for it.
 */
export const MAX_CUSTOM_FONT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const FORMAT_BY_EXTENSION: Record<string, CustomFontFormat> = {
  woff2: 'woff2',
  ttf: 'truetype',
  otf: 'opentype',
};

/** Accepted file extensions, in the form antd's `Upload accept=` prop expects. */
export const CUSTOM_FONT_ACCEPT = Object.keys(FORMAT_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(',');

/**
 * Content-type sent to the `r2-presigned-upload` edge function for each
 * format — derived from the file extension (see `customFontFormatForFileName`)
 * rather than trusting `File.type`, since browsers report inconsistent or
 * empty MIME types for `.ttf`/`.otf` uploads.
 */
export const CUSTOM_FONT_CONTENT_TYPE: Record<CustomFontFormat, string> = {
  woff2: 'font/woff2',
  truetype: 'font/ttf',
  opentype: 'font/otf',
};

function extensionOf(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
}

/** Resolves a `CustomFontFormat` from a file's name, or `null` for an unsupported extension. */
export function customFontFormatForFileName(fileName: string): CustomFontFormat | null {
  return FORMAT_BY_EXTENSION[extensionOf(fileName)] ?? null;
}

/**
 * Builds a synthetic, collision-safe CSS `font-family` name for an upload —
 * never the raw filename verbatim, since it needs to be safe to embed inside
 * a generated `@font-face` CSS rule (`src/utils/loadGoogleFont.ts`) and
 * unique enough that two campaigns' custom fonts never collide in the same
 * page's `document.fonts`/stylesheet registry.
 */
export function buildCustomFontFamilyName(originalFileName: string): string {
  const base = originalFileName
    .slice(0, originalFileName.lastIndexOf('.'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `custom-${base || 'font'}-${suffix}`;
}
