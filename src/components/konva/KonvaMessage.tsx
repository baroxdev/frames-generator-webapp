import { useMemo } from "react";
import { Text } from "react-konva";

import { cssFontFamily } from "../../constants/fonts";
import { ObjectLayer } from "../../types";
import { fitTextFontSize } from "../../utils/fitTextToBox";
import { measureTextWidth } from "../../utils/measureText";
import { buildFontString, MESSAGE_FONT_WEIGHT } from "../../utils/textFonts";
import { TEXT_3XL_PX, TEXT_5XL_PX } from "./textSizes";

// Mirrors Message.tsx's own constant/reasoning exactly.
const MAX_AUTO_FIT_FONT_FACTOR = 0.08;

/** Konva port of Message.tsx. */
export function KonvaMessage({
  content,
  height,
  width,
  x,
  y,
  textColor,
  autoFit,
  fontFamily,
  customFont,
}: ObjectLayer) {
  const message = content || "Thông điệp của bạn";
  const resolvedFontFamily = cssFontFamily(fontFamily, Boolean(customFont));

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: message,
      box: { width, height },
      multiline: true,
      maxFontSize: Math.min(width, height) * MAX_AUTO_FIT_FONT_FACTOR,
      measure: (measuredText, fontSizePx) =>
        measureTextWidth(
          measuredText,
          buildFontString(MESSAGE_FONT_WEIGHT, fontSizePx, resolvedFontFamily),
        ),
    });
  }, [autoFit, message, width, height, resolvedFontFamily]);

  const limit = 150;
  const isLong = message.length > limit;
  const isShort = message.length < limit;
  const fontSize = autoFitSize ?? (isLong ? TEXT_3XL_PX : isShort ? TEXT_5XL_PX : undefined);
  const verticalAlign = autoFit || isShort ? "middle" : "top";

  return (
    <Text
      x={y}
      y={x - 15}
      width={width}
      height={height}
      text={message}
      fontSize={fontSize}
      fontStyle={String(MESSAGE_FONT_WEIGHT)}
      fontFamily={resolvedFontFamily}
      fill={textColor ?? "#1e3a8a"}
      align="justify"
      verticalAlign={verticalAlign}
      wrap="word"
      lineHeight={1.2}
    />
  );
}
