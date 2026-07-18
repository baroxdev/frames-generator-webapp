import html2canvas from 'html2canvas-pro';
import { getExportWindowWidth } from './frameExport.service';

/**
 * Rasterizes a rendered `PrintArea` node into a downloadable JPEG data URL.
 * Extracted from App.tsx's original `generateDataUrl` (the only place this
 * logic used to live) so #6's visitor submission flow can reuse the exact
 * same export pipeline instead of re-implementing it.
 *
 * `node` must be the DOM node `PrintArea`'s forwarded ref points at — see
 * that component's doc comment for why it stays off-screen rather than
 * `display:none` (html2canvas cannot rasterize a display:none element).
 */
export async function compositeFrameToDataUrl(node: HTMLElement, canvasWidth: number): Promise<string> {
  if ('fonts' in document) {
    await document.fonts.ready;
  }

  const canvas = await html2canvas(node, {
    windowWidth: getExportWindowWidth(canvasWidth),
    useCORS: true,
    allowTaint: true,
    logging: false,
    scale: 2,
  });

  return canvas.toDataURL('image/jpeg', 0.9);
}
