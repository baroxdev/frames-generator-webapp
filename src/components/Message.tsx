import clsx from 'clsx';

import { ObjectLayer } from '../types';

const Message = ({ content, height, width, x, y, isDev, textColor }: ObjectLayer) => {
  const defaultMessage = 'Thông điệp của bạn';
  const message = content || defaultMessage;
  const limit = 150;
  const lte = message.length < limit;
  const gte = message.length > limit;

  return (
    <div
      className={clsx('absolute ', {
        'flex items-center justify-center': lte,
        'bg-transparent': !isDev,
        'bg-black text-white': isDev,
      })}
      style={{
        width: width,
        height: height,
        top: x - 15,
        left: y,
        fontFamily: `'Lobster', cursive`,
      }}
    >
      <p
        className={clsx('font-medium', {
          'text-3xl ': gte,
          'text-5xl text-center': lte,
          'text-blue-900': !textColor,
        })}
        style={textColor ? { color: textColor } : undefined}
      >
        {message}
      </p>
    </div>
  );
};

export default Message;
