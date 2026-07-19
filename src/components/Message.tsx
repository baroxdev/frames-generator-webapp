import clsx from "clsx";
import { useEffect, useMemo } from "react";

import { cssFontFamily } from "../constants/fonts";
import { ObjectLayer } from "../types";
import { fitTextFontSize } from "../utils/fitTextToBox";
import { loadFont } from "../utils/loadGoogleFont";
import { measureTextWidth } from "../utils/measureText";
import { buildFontString, MESSAGE_FONT_WEIGHT } from "../utils/textFonts";

// A fraction of the box's own smaller dimension, not an absolute px value —
// a campaign's canvas size is derived from whatever background the owner
// uploads (see defaultLayout.ts), which can range from a few hundred px to
// well over ten thousand; an absolute cap stays sane at typical sizes but
// clamps the message to a barely-visible sliver of a much larger box on an
// oversized upload. Smaller than Name/Role's own default factor (0.6) since
// unlike a name/role, a message wraps across multiple lines and shouldn't
// blow up to billboard size just because a single short line would fit.
const MAX_AUTO_FIT_FONT_FACTOR = 0.08;

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
  customFont,
}: ObjectLayer) => {
  const defaultMessage = "Thông điệp của bạn";
  const message = content || defaultMessage;
  const resolvedFontFamily = cssFontFamily(fontFamily, Boolean(customFont));

  useEffect(() => {
    loadFont(fontFamily, customFont);
  }, [fontFamily, customFont]);

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: message,
      box: { width, height },
      multiline: true,
      maxFontSize: Math.min(width, height) * MAX_AUTO_FIT_FONT_FACTOR,
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
        "flex items-center justify-left": autoFit || lte,
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
          "text-3xl text-justify": !autoFit && gte,
          "text-5xl text-justify": !autoFit && lte,
          "text-justify": autoFit,
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
