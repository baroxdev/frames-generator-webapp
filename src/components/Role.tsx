import clsx from 'clsx';

import { ObjectLayer } from '../types';

const Role = ({ content, height, width, x, y, isDev, limit }: ObjectLayer) => {
  const _limit = limit || 25;
  const defaultRole = 'Chức vụ của bạn';
  const role = content || defaultRole;
  const lte = role.length <= _limit;
  const gt = role.length > _limit;

  return (
    <div
      className={clsx('absolute whitespace-nowrap', isDev ? 'bg-black' : 'bg-transparent')}
      style={{
        height: height,
        width: width,
        top: gt ? x + 5 : x,
        left: y,
      }}
    >
      <p
        className={clsx('font-sans font-bold text-center text-white', {
          'text-xl': gt,
          'text-3xl': lte,
        })}
      >
        {role}
      </p>
    </div>
  );
};

export default Role;
