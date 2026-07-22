import Konva from "konva";
import React, { useEffect, useRef } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";

import { NAME_FIELD_PREFIX, ROLE_FIELD_PREFIX } from "../constants/fieldPrefixes";
import { KonvaAutoFitText } from "./konva/KonvaAutoFitText";
import { KonvaAvatar } from "./konva/KonvaAvatar";
import { KonvaMessage } from "./konva/KonvaMessage";
import { useHtmlImage } from "../hooks/useHtmlImage";
import { resolveTemplateLayout } from "../templates/resolveTemplate";
import { FrameContent, Template } from "../templates/types";
import { ensureFontReady } from "../utils/loadGoogleFont";
import { MESSAGE_FONT_WEIGHT, NAME_ROLE_FONT_WEIGHT } from "../utils/textFonts";

interface KonvaPrintAreaProps {
  template: Template;
  content: FrameContent;
}

/**
 * Konva-rendered equivalent of `PrintArea.tsx` — a spike
 * (docs/specs/print-area-konva-spike or PR description) validating whether
 * canvas-native text rendering avoids the Safari export font-fallback bug
 * `PrintArea` + `domToBlob` hits (see `loadGoogleFont.ts`'s doc comment on
 * `injectCustomFontFace`). Not wired into the real export paths
 * (`App.tsx`/`CampaignPublicPage.tsx`) yet — see `src/pages/dev/
 * PrintAreaKonvaSpike.tsx`, the standalone comparison page this exists for.
 *
 * Exposes the underlying `Konva.Stage` via ref so a caller can export it
 * (see `frameCompositor.konva.ts`) exactly like `PrintArea`'s ref exposes
 * the DOM node `compositeFrameToBlob` rasterizes.
 */
export const KonvaPrintArea = React.forwardRef<Konva.Stage, KonvaPrintAreaProps>(
  ({ template, content }, ref) => {
    const layout = resolveTemplateLayout(template, content);
    const layerRef = useRef<Konva.Layer>(null);
    const background = useHtmlImage(layout.background);

    // Unlike CSS, Konva's canvas doesn't repaint itself when a webfont
    // finishes loading after the first draw — same gap LayoutEditor.tsx
    // already closes for its own preview. `ensureFontReady` (already used
    // by the DOM export path) resolves once the family/weight is actually
    // usable; redraw once that's true so a font requested moments earlier
    // doesn't silently render with a fallback.
    useEffect(() => {
      let cancelled = false;
      Promise.all([
        ensureFontReady(layout.name.fontFamily, NAME_ROLE_FONT_WEIGHT, layout.name.customFont),
        ensureFontReady(layout.message.fontFamily, MESSAGE_FONT_WEIGHT, layout.message.customFont),
      ]).then(() => {
        if (!cancelled) layerRef.current?.batchDraw();
      });
      return () => {
        cancelled = true;
      };
    }, [layout.name.fontFamily, layout.name.customFont, layout.message.fontFamily, layout.message.customFont]);

    return (
      <Stage ref={ref} width={layout.canvas.width} height={layout.canvas.height}>
        <Layer ref={layerRef}>
          {background && (
            <KonvaImage
              image={background}
              x={0}
              y={0}
              width={layout.canvas.width}
              height={layout.canvas.height}
            />
          )}
          <KonvaAvatar {...layout.avatar} />
          <KonvaAutoFitText {...layout.name} defaultText="Tên của bạn" prefix={NAME_FIELD_PREFIX} />
          <KonvaAutoFitText {...layout.role} defaultText="Chức vụ của bạn" prefix={ROLE_FIELD_PREFIX} />
          <KonvaMessage {...layout.message} />
        </Layer>
      </Stage>
    );
  },
);

KonvaPrintArea.displayName = "KonvaPrintArea";
