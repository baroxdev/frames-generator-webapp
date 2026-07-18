import clsx from "clsx";
import { useMemo } from "react";

import { ObjectLayer } from "../types";
import { fitTextFontSize } from "../utils/fitTextToBox";
import { measureTextWidth } from "../utils/measureText";
import { fontAtSize, NAME_ROLE_FONT_TEMPLATE } from "../utils/textFonts";

/** `autoFit` (opt-in) replaces the `limit`-based two-tier shrink below with a continuous font size fit to this box's own width/height and content length — see Name.tsx, which mirrors this component. */
const Role = ({
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
  const defaultRole = "Chức vụ của bạn";
  const role = content || defaultRole;

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: role,
      box: { width, height },
      measure: (text, fontSizePx) =>
        measureTextWidth(text, fontAtSize(NAME_ROLE_FONT_TEMPLATE, fontSizePx)),
    });
  }, [autoFit, role, width, height]);

  const _limit = limit || 25;
  const lte = role.length <= _limit;
  const gt = role.length > _limit;

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
        {role}
      </p>
    </div>
  );
};

export default Role;
