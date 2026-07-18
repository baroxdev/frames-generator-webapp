import { domToBlob } from 'modern-screenshot';

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
 */
export async function compositeFrameToBlob(node: HTMLElement): Promise<Blob> {
  if ('fonts' in document) {
    await document.fonts.ready;
  }

  return domToBlob(node, {
    type: 'image/jpeg',
    quality: 0.9,
    scale: 2,
    font: {},
  });
}
