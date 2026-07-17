import { AvatarShape } from '../templates/types';
import { ObjectLayer } from '../types';

interface AvatarProps extends ObjectLayer {
  /**
   * Crop shape for the avatar photo. Defaults to 'circle' (today's live
   * layout).
   *
   * Only `border-radius` and `transform: rotate()` are used to draw these
   * shapes — html2canvas-pro (the export pipeline in `generateDataUrl`,
   * App.tsx) does not rasterize `clip-path`, so a shape built from
   * clip-path renders correctly on-screen but silently loses its crop in
   * the exported/downloaded image. `border-radius` and `transform` are
   * both well-supported by the export pipeline.
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
