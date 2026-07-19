import clsx from "clsx";
import React from "react";

import { FrameContent, Template } from "../templates/types";
import { resolveTemplateLayout } from "../templates/resolveTemplate";
import Avatar from "./Avatar";
import Message from "./Message";
import Name from "./Name";
import Role from "./Role";

interface PrintAreaProps {
  isDevMod?: boolean;
  template: Template;
  content: FrameContent;
}

/**
 * Composition root for a generated frame: draws a template's background and
 * its four boxes (avatar, name, role, message), all positioned per the
 * template's config rather than hardcoded coordinates.
 *
 * The forwarded ref points at the exact node the compositor
 * (`frameCompositor.service.ts`) rasterizes for export, so this markup must
 * stay something it can actually capture — kept off-screen via `z-[-1]`,
 * never `display:none`, which leaves a node with no layout box to capture.
 */
const PrintArea = React.forwardRef<HTMLDivElement, PrintAreaProps>(
  ({ isDevMod, template, content }, ref) => {
    const layout = resolveTemplateLayout(template, content);

    return (
      <div
        className="relative overflow-hidden"
        style={{
          width: layout.canvas.width,
          height: layout.canvas.height,
        }}
      >
        <div
          className={clsx("absolute inset-0", isDevMod ? "z-[99]" : "z-[-1]")}
          ref={ref}
        >
          <img
            crossOrigin="anonymous"
            src={layout.background}
            width={layout.canvas.width}
            height={layout.canvas.height}
            style={{ width: layout.canvas.width, height: layout.canvas.height }}
          />
          <Avatar
            width={layout.avatar.width}
            height={layout.avatar.height}
            x={layout.avatar.x}
            y={layout.avatar.y}
            content={layout.avatar.content}
            shape={layout.avatar.shape}
            clipAxis={layout.avatar.clipAxis}
            clipRatio={layout.avatar.clipRatio}
            clipKeepEnd={layout.avatar.clipKeepEnd}
          />
          <Name
            width={layout.name.width}
            height={layout.name.height}
            x={layout.name.x}
            y={layout.name.y}
            content={layout.name.content}
            limit={layout.name.limit}
            textColor={layout.name.textColor}
            autoFit={layout.name.autoFit}
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
            autoFit={layout.role.autoFit}
            isDev={isDevMod}
          />
          <Message
            width={layout.message.width}
            height={layout.message.height}
            x={layout.message.x}
            y={layout.message.y}
            content={layout.message.content}
            textColor={layout.message.textColor}
            autoFit={layout.message.autoFit}
            isDev={isDevMod}
          />
        </div>
      </div>
    );
  },
);

PrintArea.displayName = "PrintArea";

export default PrintArea;
