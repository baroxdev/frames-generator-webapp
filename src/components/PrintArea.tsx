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
            fontFamily={layout.name.fontFamily}
            customFont={layout.name.customFont}
            showPrefix={layout.name.showPrefix}
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
            fontFamily={layout.role.fontFamily}
            customFont={layout.role.customFont}
            showPrefix={layout.role.showPrefix}
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
            fontFamily={layout.message.fontFamily}
            customFont={layout.message.customFont}
            isDev={isDevMod}
          />
        </div>
      </div>
    );
  },
);

PrintArea.displayName = "PrintArea";

export default PrintArea;
