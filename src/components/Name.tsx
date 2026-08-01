import clsx from "clsx";
import { useEffect, useMemo } from "react";

import { cssFontFamily } from "../constants/fonts";
import { NAME_FIELD_PREFIX } from "../constants/fieldPrefixes";
import { ObjectLayer } from "../types";
import { fitTextFontSize } from "../utils/fitTextToBox";
import { loadFont } from "../utils/loadGoogleFont";
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

  useEffect(() => {
    loadFont(fontFamily, customFont);
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
  }, [autoFit, name, width, height, resolvedFontFamily]);

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
