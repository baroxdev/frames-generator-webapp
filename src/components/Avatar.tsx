import { AvatarShape } from '../templates/types';
import { ObjectLayer } from '../types';
import { buildChordClipPath } from '../utils/circleClip';

interface AvatarProps extends ObjectLayer {
  /**
   * Crop shape for the avatar photo. Defaults to 'circle' (today's live
   * layout).
   *
   * `diamond` and the plain full `circle`/`square` cases still use
   * `border-radius`/`transform: rotate()`, but a `circle` with `clipAxis`
   * set uses `clip-path: path(...)` instead (see `src/utils/circleClip.ts`),
   * applied as an inline `style` — the same mechanism the compositor
   * (`modern-screenshot`, see `frameCompositor.service.ts`) already relies
   * on for `borderRadius`, so it survives the DOM clone/serialize/rasterize
   * export pipeline the same way (verified against actual exported output,
   * not just the preview).
   */
  shape?: AvatarShape;
  /** Only meaningful when `shape === 'circle'` — see `AvatarBoxConfig`. */
  clipAxis?: 'horizontal' | 'vertical';
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
  shape = 'circle',
  clipAxis,
  clipRatio,
  clipKeepEnd,
}: AvatarProps) => {
  const imageUrl = content ?? 'https://source.unsplash.com/random';

  if (shape === 'diamond') {
    return (
      <div
        className='absolute overflow-hidden'
        style={{
          height: height,
          width: width,
          top: x,
          left: y,
          transform: 'rotate(45deg)',
          ...style,
        }}
      >
        <img
          className='object-cover'
          style={{
            width: '142%',
            height: '142%',
            position: 'absolute',
            top: '-21%',
            left: '-21%',
            transform: 'rotate(-45deg)',
          }}
          src={imageUrl}
        />
      </div>
    );
  }

  const hasChordClip = shape === 'circle' && clipAxis != null;

  return (
    <div
      className='absolute overflow-hidden'
      style={{
        height: height,
        width: width,
        top: x,
        left: y,
        borderRadius: shape === 'circle' && !hasChordClip ? '9999px' : undefined,
        clipPath: hasChordClip
          ? buildChordClipPath(width, height, clipAxis!, clipRatio ?? 0.5, clipKeepEnd ?? false)
          : undefined,
        ...style,
      }}
    >
      <img className='object-cover w-full h-full' src={imageUrl} />
    </div>
  );
};

export default Avatar;
