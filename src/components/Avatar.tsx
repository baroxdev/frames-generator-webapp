import { ObjectLayer } from '../types';

const Avatar = ({ height, width, x, y, content, style }: ObjectLayer) => {
  const imageUrl = content ?? 'https://source.unsplash.com/random';

  return (
    <div
      className='absolute overflow-hidden'
      style={{
        height: height,
        width: width,
        top: x,
        left: y,
        ...style,
      }}
    >
      <div
        className='overflow-hidden octagonWrap'
        style={{
          height: height,
          width: width,
        }}
      >
        <div
          className='overflow-hidden octagon aspect-square'
          style={{
            width: width,
          }}
        >
          <img className='object-cover w-full h-full' src={imageUrl} />
        </div>
      </div>
    </div>
  );
};

export default Avatar;
