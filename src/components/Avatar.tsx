import { AvatarShape } from '../templates/types';
import { ObjectLayer } from '../types';

interface AvatarProps extends ObjectLayer {
  /**
   * Crop shape for the avatar photo. Defaults to 'circle' (today's live
   * layout).
   *
   * Only `border-radius` and `transform: rotate()` are used to draw these
   * shapes, not `clip-path` — kept consistent with how this has always been
   * drawn rather than re-verified against the current compositor
   * (`modern-screenshot`, see `frameCompositor.service.ts`), which — unlike
   * the previous html2canvas-based pipeline — delegates to the real browser
   * rendering engine and may well support `clip-path` correctly.
   */
  shape?: AvatarShape;
}

const Avatar = ({ height, width, x, y, content, style, shape = 'circle' }: AvatarProps) => {
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

  return (
    <div
      className='absolute overflow-hidden'
      style={{
        height: height,
        width: width,
        top: x,
        left: y,
        borderRadius: shape === 'circle' ? '9999px' : undefined,
        ...style,
      }}
    >
      <img className='object-cover w-full h-full' src={imageUrl} />
    </div>
  );
};

export default Avatar;
