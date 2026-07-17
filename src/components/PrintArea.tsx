import clsx from 'clsx';
import React from 'react';

import { FrameContent, Template } from '../templates/types';
import { resolveTemplateLayout } from '../templates/resolveTemplate';
import Avatar from './Avatar';
import Message from './Message';
import Name from './Name';
import Role from './Role';

interface PrintAreaProps {
  isDevMod?: boolean;
  /** The template's coordinate/config schema — swap this to change the whole layout. */
  template: Template;
  /** The submission's data to render into the template's boxes. */
  content: FrameContent;
}

/**
 * Composition root for a generated frame: draws a template's background and
 * its four boxes (avatar, name, role, message), all positioned per the
 * template's config rather than hardcoded coordinates.
 *
 * The forwarded ref points at the exact node `html2canvas` rasterizes for
 * export (see `generateDataUrl` in App.tsx), so this markup must stay
 * something html2canvas can actually capture — kept off-screen via
 * `z-[-1]`, never `display:none`, which html2canvas cannot rasterize.
 */
const PrintArea = React.forwardRef<HTMLDivElement, PrintAreaProps>(
  ({ isDevMod, template, content }, ref) => {
    const layout = resolveTemplateLayout(template, content);

    return (
      <div className='overflow-hidden'>
        <div
          className={clsx('absolute top-0 left-0', isDevMod ? 'z-[99]' : 'z-[-1]')}
          ref={ref}
        >
          <img
            crossOrigin='anonymous'
            src={layout.background}
            width={layout.canvas.width}
            height={layout.canvas.height}
            // Tailwind's preflight resets `img { height: auto }`, which
            // beats the width/height *attributes* above in the cascade —
            // any background whose natural aspect ratio doesn't happen to
            // match the template's canvas would silently render at the
            // wrong height (box coordinates would still be correct, but
            // they'd land on a stretched-or-not, wrong-sized image). The
            // inline style wins over that reset, so the canvas is always
            // exactly the template's declared size.
            style={{ width: layout.canvas.width, height: layout.canvas.height }}
          />
          <Avatar
            width={layout.avatar.width}
            height={layout.avatar.height}
            x={layout.avatar.x}
            y={layout.avatar.y}
            content={layout.avatar.content}
            shape={layout.avatar.shape}
          />
          <Name
            width={layout.name.width}
            height={layout.name.height}
            x={layout.name.x}
            y={layout.name.y}
            content={layout.name.content}
            limit={layout.name.limit}
            textColor={layout.name.textColor}
            isDev={isDevMod}
          />
          <Role
            width={layout.role.width}
            height={layout.role.height}
            x={layout.role.x}
            y={layout.role.y}
            content={layout.role.content}
            limit={layout.role.limit}
            textColor={layout.role.textColor}
            isDev={isDevMod}
          />
          <Message
            width={layout.message.width}
            height={layout.message.height}
            x={layout.message.x}
            y={layout.message.y}
            content={layout.message.content}
            textColor={layout.message.textColor}
            isDev={isDevMod}
          />
        </div>
      </div>
    );
  }
);

PrintArea.displayName = 'PrintArea';

export default PrintArea;
