import clsx from "clsx";
import { useEffect, useMemo } from "react";

import { cssFontFamily } from "../constants/fonts";
import { ObjectLayer } from "../types";
import { fitTextFontSize } from "../utils/fitTextToBox";
import { loadGoogleFont } from "../utils/loadGoogleFont";
import { measureTextWidth } from "../utils/measureText";
import { buildFontString, MESSAGE_FONT_WEIGHT } from "../utils/textFonts";

const MAX_AUTO_FIT_FONT_SIZE = 150;

/** `autoFit` (opt-in) replaces the length-based two-tier shrink below with a continuous, word-wrap-aware font size fit to this box's own width/height and content length — see Name.tsx/Role.tsx, which use the same mechanism in single-line mode. */
const Message = ({
  content,
  height,
  width,
  x,
  y,
  isDev,
  textColor,
  autoFit,
  fontFamily,
}: ObjectLayer) => {
  const defaultMessage = "Thông điệp của bạn";
  const message = content || defaultMessage;
  const resolvedFontFamily = cssFontFamily(fontFamily);

  useEffect(() => {
    loadGoogleFont(fontFamily);
  }, [fontFamily]);

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: message,
      box: { width, height },
      multiline: true,
      maxFontSize: MAX_AUTO_FIT_FONT_SIZE,
      measure: (text, fontSizePx) =>
        measureTextWidth(
          text,
          buildFontString(MESSAGE_FONT_WEIGHT, fontSizePx, resolvedFontFamily),
        ),
    });
  }, [autoFit, message, width, height, resolvedFontFamily]);

  const limit = 150;
  const lte = message.length < limit;
  const gte = message.length > limit;

  return (
    <div
      className={clsx("absolute ", {
        "flex items-center justify-center": autoFit || lte,
        "bg-transparent": !isDev,
        "bg-black text-white": isDev,
      })}
      style={{
        width: width,
        height: height,
        top: x - 15,
        left: y,
        fontFamily: resolvedFontFamily,
      }}
    >
      <p
        className={clsx("font-medium", {
          "text-3xl ": !autoFit && gte,
          "text-5xl text-center": !autoFit && lte,
          "text-center": autoFit,
          "text-blue-900": !textColor,
        })}
        style={{
          ...(textColor ? { color: textColor } : undefined),
          ...(autoFitSize
            ? { fontSize: `${autoFitSize}px`, lineHeight: 1.2 }
            : undefined),
        }}
      >
        {message}
      </p>
    </div>
  );
};

export default Message;
