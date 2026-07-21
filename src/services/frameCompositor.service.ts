import { domToBlob } from 'modern-screenshot';

import type { CustomFont } from '../templates/types';
import { ensureFontReady } from '../utils/loadGoogleFont';
import { MESSAGE_FONT_WEIGHT, NAME_ROLE_FONT_WEIGHT } from '../utils/textFonts';
import { waitForImagesReady } from '../utils/waitForImagesReady';

// Common social platforms (Facebook, Zalo, etc.) downscale a shared image's
// long edge to somewhere in this neighborhood server-side regardless of
// what's uploaded — exporting at a higher resolution than this spends bytes
// on pixels no viewer will ever actually see. Matches
// resizeImageIfOversized's own background-upload cap (2400px) so a sharp
// background doesn't take a second, redundant downscale here on export.
const MAX_EXPORT_LONG_EDGE = 2400;
// Upper bound on the rasterization multiplier itself, so a small campaign
// canvas doesn't get supersampled far beyond any visible benefit.
const MAX_EXPORT_SCALE = 2;

/**
 * Picks a rasterization scale so the exported image's long edge lands at
 * `MAX_EXPORT_LONG_EDGE` regardless of the campaign's own canvas size —
 * before the free-form layout editor, every canvas was a fixed, modest
 * template size and a flat `scale: 2` was harmless; now a campaign's canvas
 * is derived directly from whatever background the owner uploaded (seen as
 * large as 5555x3124 in testing), so a flat multiplier could rasterize at
 * tens of megapixels for no visual benefit and a large file-size cost.
 *
 * A small canvas still gets scaled *up* to `MAX_EXPORT_SCALE`, not forced
 * down to fit exactly `MAX_EXPORT_LONG_EDGE` — there's no benefit to
 * supersampling far past that, but under it, standard crisper-export
 * behavior is kept.
 */
export function computeExportScale(node: HTMLElement): number {
  const longEdge = Math.max(node.offsetWidth, node.offsetHeight);
  if (longEdge <= 0) return MAX_EXPORT_SCALE;
  return Math.min(MAX_EXPORT_LONG_EDGE / longEdge, MAX_EXPORT_SCALE);
}

/**
 * Rasterizes a rendered `PrintArea` node into the final composited JPEG,
 * as a `Blob` — extracted from App.tsx's original `generateDataUrl` (the
 * only place this logic used to live) so #6's visitor submission flow can
 * reuse the exact same export pipeline instead of re-implementing it.
 *
 * Uses `modern-screenshot` (SVG `foreignObject`-based) rather than
 * html2canvas: html2canvas reimplements CSS layout/color-parsing from
 * scratch in JS, which is the root cause of both the position drift this
 * repo used to work around (the `getExportWindowWidth` virtual-window hack,
 * now gone) and its color-parsing bugs (modern CSS color functions like
 * oklch — the reason this repo was on the "-pro" html2canvas fork before).
 * `modern-screenshot` delegates to the real browser rendering engine
 * instead, and separately has a purpose-built `font` option to embed
 * custom/Google fonts into the export — a longstanding weak spot for
 * html2canvas.
 *
 * `node` must be the DOM node `PrintArea`'s forwarded ref points at — see
 * that component's doc comment for why it stays off-screen rather than
 * `display:none` (a `display:none` node has no layout box for anything to
 * capture).
 *
 * `fontFamily` should be the campaign's own `layout.fontFamily` (the font
 * Name/Role/Message are actually styled with). Explicitly awaiting its
 * readiness here — not just `document.fonts.ready` — matters because a
 * campaign owner can pick a font that was only just requested (a `<link>`
 * added moments earlier by Name/Role/Message's own mount effect); without
 * this, a visitor submitting quickly enough could get an export rasterized
 * with a fallback font instead of the one actually selected. See
 * `ensureFontReady`'s doc comment for why `document.fonts.ready` alone
 * isn't sufficient.
 *
 * `customFont`, when set, is the campaign's own uploaded font (see
 * `CustomFont` in `src/templates/types.ts`) — takes priority over
 * `fontFamily` for loading purposes, same as `Name`/`Role`/`Message`.
 *
 * Also awaits every `<img>` inside `node` via `waitForImagesReady` — the
 * avatar's `blob:` URL is freshly created moments before this runs (see
 * `CampaignPublicPage.handleSubmit`), so without this a slower device can
 * rasterize before the image is decoded, producing a solid black avatar
 * with no error (seen on Android via session replay).
 */
export async function compositeFrameToBlob(
  node: HTMLElement,
  fontFamily?: string,
  customFont?: CustomFont,
): Promise<Blob> {
  await Promise.all([
    ensureFontReady(fontFamily, NAME_ROLE_FONT_WEIGHT, customFont),
    ensureFontReady(fontFamily, MESSAGE_FONT_WEIGHT, customFont),
    waitForImagesReady(node),
  ]);
  if ('fonts' in document) {
    await document.fonts.ready;
  }

  return domToBlob(node, {
    type: 'image/jpeg',
    quality: 0.85,
    scale: computeExportScale(node),
    font: {},
  });
}
