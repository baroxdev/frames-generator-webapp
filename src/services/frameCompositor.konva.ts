import Konva from "konva";

import type { CustomFont } from "../templates/types";
import { ensureFontReady } from "../utils/loadGoogleFont";
import { MESSAGE_FONT_WEIGHT, NAME_ROLE_FONT_WEIGHT } from "../utils/textFonts";

// Mirrors frameCompositor.service.ts's own constants and reasoning exactly
// — see that file's doc comment for why these specific numbers.
const MAX_EXPORT_LONG_EDGE = 2400;
const MAX_EXPORT_SCALE = 2;

export function computeExportScaleForStage(stage: Konva.Stage): number {
  const longEdge = Math.max(stage.width(), stage.height());
  if (longEdge <= 0) return MAX_EXPORT_SCALE;
  return Math.min(MAX_EXPORT_LONG_EDGE / longEdge, MAX_EXPORT_SCALE);
}

/**
 * Konva equivalent of `compositeFrameToBlob` (frameCompositor.service.ts) —
 * spike/Phase 1 counterpart exercised by the dev print-area comparison page
 * (`src/pages/dev/PrintAreaKonvaSpike.tsx`), not yet wired into the real
 * export paths (`App.tsx`/`CampaignPublicPage.tsx`).
 *
 * Unlike the DOM path, there's no `waitForImagesReady`/`domToBlob`
 * font-auto-discovery step: by the time `KonvaPrintArea` renders, its
 * `Konva.Image` nodes already hold fully-loaded `HTMLImageElement`s (via
 * `useHtmlImage`), and `stage.toBlob()` rasterizes the canvas Konva already
 * drew to directly — no DOM/SVG serialization involved, which is the whole
 * point of this spike (see `KonvaPrintArea.tsx`'s doc comment).
 */
export async function compositeFrameToBlobKonva(
  stage: Konva.Stage,
  fontFamily?: string,
  customFont?: CustomFont,
): Promise<Blob> {
  await Promise.all([
    ensureFontReady(fontFamily, NAME_ROLE_FONT_WEIGHT, customFont),
    ensureFontReady(fontFamily, MESSAGE_FONT_WEIGHT, customFont),
  ]);
  if ("fonts" in document) {
    await document.fonts.ready;
  }
  stage.batchDraw();

  const blob = await stage.toBlob({
    mimeType: "image/jpeg",
    quality: 0.95,
    pixelRatio: computeExportScaleForStage(stage),
  });
  return blob as Blob;
}
