import clsx from 'clsx';

import { ObjectLayer } from '../types';

/**
 * Renders a submitter's full name inside a template's name box.
 *
 * Mirrors Role.tsx on purpose (same box/shrink-on-overflow mechanics) but is
 * its own component: the ticket's four submission fields — avatar, name,
 * role, message — are treated as four distinct concerns, and templates may
 * want to style a name differently from a role (e.g. bolder, larger) even
 * though the rendering mechanics are the same today.
 */
const Name = ({ content, height, width, x, y, isDev, limit, textColor }: ObjectLayer) => {
  const _limit = limit || 25;
  const defaultName = 'Tên của bạn';
  const name = content || defaultName;
  const lte = name.length <= _limit;
  const gt = name.length > _limit;

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
        className={clsx('font-sans font-bold text-center', {
          'text-xl': gt,
          'text-3xl': lte,
          'text-white': !textColor,
        })}
        style={textColor ? { color: textColor } : undefined}
      >
        {name}
      </p>
    </div>
  );
};

export default Name;
