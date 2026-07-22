import Konva from "konva";
import { Group, Image as KonvaImage } from "react-konva";

import { useHtmlImage } from "../../hooks/useHtmlImage";
import { AvatarShape } from "../../templates/types";
import { ObjectLayer } from "../../types";
import { buildChordSegment } from "../../utils/circleClip";
import { getCoverCrop } from "./geometry/getImageCrop";
import { tracePathData } from "./geometry/svgPathClip";

interface KonvaAvatarProps extends ObjectLayer {
  shape?: AvatarShape;
  /** Only meaningful when `shape === 'circle'` — see `AvatarBoxConfig`. */
  clipAxis?: "horizontal" | "vertical";
  clipRatio?: number;
  clipKeepEnd?: boolean;
}

const DEFAULT_AVATAR_URL = "https://source.unsplash.com/random";

/**
 * Konva port of `Avatar.tsx`. `x`/`y` follow the same swap every
 * `ObjectLayer` consumer uses (`x` = box top, `y` = box left).
 */
export function KonvaAvatar({
  height,
  width,
  x: top,
  y: left,
  content,
  shape = "circle",
  clipAxis,
  clipRatio,
  clipKeepEnd,
}: KonvaAvatarProps) {
  const image = useHtmlImage(content ?? DEFAULT_AVATAR_URL);
  if (!image) return null;

  if (shape === "diamond") {
    // Mirrors Avatar.tsx's diamond case: an outer box rotated 45deg and
    // clipped to itself (producing the diamond), with the image
    // counter-rotated back to upright inside it. The image is cover-cropped
    // against the diamond's own larger (√2×) axis-aligned bounding box, not
    // the box itself — otherwise the upright image wouldn't reach the
    // diamond's top/bottom/left/right points. See gallery.ts's comment on
    // `classicDiamond.avatarBox` for the same √2 relationship from the
    // template-authoring side.
    const overSize = { width: width * Math.SQRT2, height: height * Math.SQRT2 };
    const crop = getCoverCrop(image, overSize);
    return (
      <Group
        x={left + width / 2}
        y={top + height / 2}
        rotation={45}
        clipFunc={(ctx: Konva.Context) => {
          ctx.beginPath();
          ctx.rect(-width / 2, -height / 2, width, height);
          ctx.closePath();
        }}
      >
        <KonvaImage
          image={image}
          x={0}
          y={0}
          offsetX={overSize.width / 2}
          offsetY={overSize.height / 2}
          width={overSize.width}
          height={overSize.height}
          rotation={-45}
          {...crop}
        />
      </Group>
    );
  }

  const crop = getCoverCrop(image, { width, height });

  if (shape === "square") {
    return (
      <KonvaImage image={image} x={left} y={top} width={width} height={height} {...crop} />
    );
  }

  const hasChordClip = clipAxis != null;

  return (
    <Group
      x={left}
      y={top}
      clipFunc={(ctx: Konva.Context) => {
        if (hasChordClip) {
          const { radius, start, end, sweep } = buildChordSegment(
            width,
            height,
            clipAxis!,
            clipRatio ?? 0.5,
            clipKeepEnd ?? false,
          );
          const largeArcFlag = sweep > 180 ? 1 : 0;
          tracePathData(
            ctx,
            `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`,
          );
        } else {
          // Mirrors CSS `border-radius: 9999px`, which clamps independently
          // per axis — a true ellipse, not a circle, for a non-square box
          // (see e.g. gallery.ts's modernPortrait: 286×260).
          ctx.beginPath();
          ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
          ctx.closePath();
        }
      }}
    >
      <KonvaImage image={image} width={width} height={height} {...crop} />
    </Group>
  );
}
