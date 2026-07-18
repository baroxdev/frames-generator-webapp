import clsx from "clsx";
import { useMemo } from "react";

import { ObjectLayer } from "../types";
import { fitTextFontSize } from "../utils/fitTextToBox";
import { measureTextWidth } from "../utils/measureText";
import { fontAtSize, NAME_ROLE_FONT_TEMPLATE } from "../utils/textFonts";

/**
 * Renders a submitter's full name inside a template's name box.
 *
 * Mirrors Role.tsx on purpose (same box/shrink-on-overflow mechanics) but is
 * its own component: the ticket's four submission fields — avatar, name,
 * role, message — are treated as four distinct concerns, and templates may
 * want to style a name differently from a role (e.g. bolder, larger) even
 * though the rendering mechanics are the same today.
 *
 * `autoFit` (opt-in — see `ObjectLayer.autoFit`) replaces the `limit`-based
 * two-tier shrink below with a continuous font size computed to fit this
 * box's own width/height and the actual content length.
 */
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
}: ObjectLayer) => {
  const defaultName = "Tên của bạn";
  const name = content || defaultName;

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: name,
      box: { width, height },
      measure: (text, fontSizePx) =>
        measureTextWidth(text, fontAtSize(NAME_ROLE_FONT_TEMPLATE, fontSizePx)),
    });
  }, [autoFit, name, width, height]);

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
        className={clsx("font-sans font-bold text-center flex-1", {
          "text-xl": !autoFit && gt,
          "text-3xl": !autoFit && lte,
          "text-white": !textColor,
        })}
        style={{
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
