import clsx from 'clsx';
import React from 'react';

import backgroundImage from '../storage/background.png';
import Avatar from './Avatar';
import Message from './Message';
import Role from './Role';

interface PrintAreaProps {
  isDevMod?: boolean;
  avatar?: string;
  fullName?: string;
  role?: string;
  message?: string;
}

const PrintArea = React.forwardRef<HTMLDivElement, PrintAreaProps>(
  ({ isDevMod, avatar, fullName, role, message }, ref) => {
    return (
      <div className={clsx('overflow-hidden hidden')}>
        <div className={clsx('absolute top-0 left-0', isDevMod ? 'z-[99]' : 'z-[-1]')} ref={ref}>
          <img
            src={backgroundImage}
            width={1500}
            height={843}
            onLoad={() => {
              console.log('background loaded!');
            }}
          />
          <div>
            <Avatar
              height={498}
              width={498}
              x={242}
              y={116}
              style={{
                height: 453,
                // opacity: 0.4,
              }}
              content={avatar}
            />
            <Role
              height={40}
              width={425}
              x={710}
              y={140}
              content={'Họ tên: ' + fullName}
              limit={30}
            />
            <Role height={35} width={450} x={750} y={125} content={'Chức vụ: ' + role} limit={29} />
          </div>
          <Message width={690} height={340} x={360} y={716} content={message} />
        </div>
      </div>
    );
  }
);

export default PrintArea;
