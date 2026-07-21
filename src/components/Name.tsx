import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { cssFontFamily } from "../constants/fonts";
import { NAME_FIELD_PREFIX } from "../constants/fieldPrefixes";
import { ObjectLayer } from "../types";
import { fitTextFontSize } from "../utils/fitTextToBox";
import { ensureFontReady } from "../utils/loadGoogleFont";
import { measureTextWidth } from "../utils/measureText";
import { buildFontString, NAME_ROLE_FONT_WEIGHT } from "../utils/textFonts";

const Name = ({
  content,
  height,
  width,
  x,
  y,
  isDev,
  limit,
  textColor,
  autoFit,
  fontFamily,
  customFont,
  showPrefix,
}: ObjectLayer) => {
  const defaultName = "Tên của bạn";
  const name = showPrefix ? `${NAME_FIELD_PREFIX}${content || defaultName}` : content || defaultName;
  const resolvedFontFamily = cssFontFamily(fontFamily, Boolean(customFont));

  // `useMemo` below runs synchronously during render, well before this
  // effect's fire-and-forget font request could ever resolve — so on a
  // cold cache (most visibly a campaign's own uploaded R2 font, which is
  // never pre-cached the way a common Google Font is) the very first
  // auto-fit measurement is taken against the fallback font's glyph widths,
  // not the real one. `fontReadyGeneration` forces that `useMemo` to
  // recompute once the actual font has finished loading — see
  // `ensureFontReady`'s doc comment and `LayoutEditor`'s matching
  // redraw-on-ready effect for the Konva-canvas equivalent of this gap.
  const [fontReadyGeneration, setFontReadyGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ensureFontReady(fontFamily, NAME_ROLE_FONT_WEIGHT, customFont).then(() => {
      if (!cancelled) setFontReadyGeneration((generation) => generation + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [fontFamily, customFont]);

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: name,
      box: { width, height },
      measure: (text, fontSizePx) =>
        measureTextWidth(
          text,
          buildFontString(
            NAME_ROLE_FONT_WEIGHT,
            fontSizePx,
            resolvedFontFamily,
          ),
        ),
    });
    // fontReadyGeneration deliberately forces a recompute once the real font
    // has loaded — it isn't read inside the callback itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFit, name, width, height, resolvedFontFamily, fontReadyGeneration]);

  const _limit = limit || 25;
  const lte = name.length <= _limit;
  const gt = name.length > _limit;

  return (
    <div
      className={clsx(
        "absolute whitespace-nowrap flex items-center",
        isDev ? "bg-black" : "bg-transparent",
      )}
      style={{
        height: height,
        width: width,
        top: !autoFit && gt ? x + 5 : x,
        left: y,
      }}
    >
      <p
        className={clsx("font-bold text-center flex-1", {
          "text-xl": !autoFit && gt,
          "text-3xl": !autoFit && lte,
          "text-white": !textColor,
        })}
        style={{
          fontFamily: resolvedFontFamily,
          ...(textColor ? { color: textColor } : undefined),
          ...(autoFitSize
            ? { fontSize: `${autoFitSize}px`, lineHeight: 1.2 }
            : undefined),
        }}
      >
        {name}
      </p>
    </div>
  );
};

export default Name;
