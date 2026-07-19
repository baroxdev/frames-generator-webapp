import { AvatarShape } from "../templates/types";
import { ObjectLayer } from "../types";
import { buildChordClipPath } from "../utils/circleClip";

interface AvatarProps extends ObjectLayer {
  shape?: AvatarShape;
  /** Only meaningful when `shape === 'circle'` — see `AvatarBoxConfig`. */
  clipAxis?: "horizontal" | "vertical";
  clipRatio?: number;
  clipKeepEnd?: boolean;
}

const Avatar = ({
  height,
  width,
  x,
  y,
  content,
  style,
  shape = "circle",
  clipAxis,
  clipRatio,
  clipKeepEnd,
}: AvatarProps) => {
  const imageUrl = content ?? "https://source.unsplash.com/random";

  if (shape === "diamond") {
    return (
      <div
        className="absolute overflow-hidden"
        style={{
          height: height,
          width: width,
          top: x,
          left: y,
          transform: "rotate(45deg)",
          ...style,
        }}
      >
        <img
          className="object-cover"
          style={{
            width: "142%",
            height: "142%",
            position: "absolute",
            top: "-21%",
            left: "-21%",
            transform: "rotate(-45deg)",
          }}
          src={imageUrl}
        />
      </div>
    );
  }

  const hasChordClip = shape === "circle" && clipAxis != null;

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        height: height,
        width: width,
        top: x,
        left: y,
        borderRadius:
          shape === "circle" && !hasChordClip ? "9999px" : undefined,
        clipPath: hasChordClip
          ? buildChordClipPath(
              width,
              height,
              clipAxis!,
              clipRatio ?? 0.5,
              clipKeepEnd ?? false,
            )
          : undefined,
        ...style,
      }}
    >
      <img className="object-cover w-full h-full" src={imageUrl} />
    </div>
  );
};

export default Avatar;
