import { useMemo } from "react";
import { Text } from "react-konva";

import { cssFontFamily } from "../../constants/fonts";
import { ObjectLayer } from "../../types";
import { fitTextFontSize } from "../../utils/fitTextToBox";
import { measureTextWidth } from "../../utils/measureText";
import { buildFontString, NAME_ROLE_FONT_WEIGHT } from "../../utils/textFonts";
import { TEXT_3XL_PX, TEXT_XL_PX } from "./textSizes";

interface KonvaAutoFitTextProps extends ObjectLayer {
  defaultText: string;
  prefix: string;
}

/**
 * Konva port of Name.tsx/Role.tsx — those two are near-identical DOM
 * components (differing only in default text and field prefix), so this one
 * parameterized component covers both call sites in `KonvaPrintArea`
 * instead of duplicating the file split.
 */
export function KonvaAutoFitText({
  content,
  height,
  width,
  x,
  y,
  limit,
  textColor,
  autoFit,
  fontFamily,
  customFont,
  showPrefix,
  defaultText,
  prefix,
}: KonvaAutoFitTextProps) {
  const text = showPrefix ? `${prefix}${content || defaultText}` : content || defaultText;
  const resolvedFontFamily = cssFontFamily(fontFamily, Boolean(customFont));

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text,
      box: { width, height },
      measure: (measuredText, fontSizePx) =>
        measureTextWidth(
          measuredText,
          buildFontString(NAME_ROLE_FONT_WEIGHT, fontSizePx, resolvedFontFamily),
        ),
    });
  }, [autoFit, text, width, height, resolvedFontFamily]);

  const effectiveLimit = limit || 25;
  const isLong = text.length > effectiveLimit;
  const fontSize = autoFitSize ?? (isLong ? TEXT_XL_PX : TEXT_3XL_PX);
  // Same `+5` vertical nudge Name.tsx/Role.tsx apply only in the
  // non-autoFit, over-limit tier.
  const top = x + (!autoFit && isLong ? 5 : 0);

  return (
    <Text
      x={y}
      y={top}
      width={width}
      height={height}
      text={text}
      fontSize={fontSize}
      fontStyle={String(NAME_ROLE_FONT_WEIGHT)}
      fontFamily={resolvedFontFamily}
      fill={textColor ?? "#fff"}
      align="center"
      verticalAlign="middle"
      wrap="none"
      lineHeight={1.2}
    />
  );
}
