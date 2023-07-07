import clsx from 'clsx';

import { ObjectLayer } from '../types';

const Message = ({ content, height, width, x, y, isDev }: ObjectLayer) => {
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
        className={clsx('font-medium text-blue-900', {
          'text-3xl ': gte,
          'text-5xl text-center': lte,
        })}
      >
        {message}
      </p>
    </div>
  );
};

export default Message;
