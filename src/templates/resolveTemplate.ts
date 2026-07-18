import { AvatarShape, CanvasSize, FrameContent, Template } from './types';

/**
 * Props shape the existing box-rendering components (Avatar/Name/Role/
 * Message) already accept. `x`/`y` map to CSS `top`/`left` respectively —
 * that mapping predates this file (see `ObjectLayer` in `src/types.d.ts`)
 * and is preserved as-is so the components themselves don't need to change.
 */
export interface ResolvedBoxProps {
  content?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  limit?: number;
  textColor?: string;
  autoFit?: boolean;
}

export interface ResolvedAvatarProps extends ResolvedBoxProps {
  shape: AvatarShape;
}

export interface ResolvedFrameLayout {
  canvas: CanvasSize;
  background: string;
  avatar: ResolvedAvatarProps;
  name: ResolvedBoxProps;
  role: ResolvedBoxProps;
  message: ResolvedBoxProps;
}

/**
 * Given a template's config and a submission's content, resolves the exact
 * props each rendering component needs. This is the seam that replaces the
 * hardcoded coordinates that used to live inside PrintArea/App.tsx: swap the
 * template and the same submission renders at entirely different
 * coordinates, on a different background.
 */
export function resolveTemplateLayout(
  template: Template,
  content: FrameContent
): ResolvedFrameLayout {
  return {
    canvas: template.canvas,
    background: template.background,
    avatar: {
      content: content.avatar,
      width: template.avatarBox.width,
      height: template.avatarBox.height,
      x: template.avatarBox.top,
      y: template.avatarBox.left,
      shape: template.avatarBox.shape,
    },
    name: {
      content: content.fullName,
      width: template.nameBox.width,
      height: template.nameBox.height,
      x: template.nameBox.top,
      y: template.nameBox.left,
      limit: template.nameBox.shrinkAt,
      textColor: template.nameBox.textColor,
      autoFit: template.nameBox.autoFit,
    },
    role: {
      content: content.role,
      width: template.roleBox.width,
      height: template.roleBox.height,
      x: template.roleBox.top,
      y: template.roleBox.left,
      limit: template.roleBox.shrinkAt,
      textColor: template.roleBox.textColor,
      autoFit: template.roleBox.autoFit,
    },
    message: {
      content: content.message,
      width: template.messageBox.width,
      height: template.messageBox.height,
      x: template.messageBox.top,
      y: template.messageBox.left,
      textColor: template.messageBox.textColor,
      autoFit: template.messageBox.autoFit,
    },
  };
}
