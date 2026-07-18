import { DEFAULT_TEMPLATE_ID, getTemplateById } from './gallery';
import type { Box, CampaignLayout, CanvasSize, TextBoxConfig } from './types';

/**
 * Free-form campaign layout editor: the owner uploads their own background
 * (any aspect ratio/resolution — the resulting canvas size is derived from
 * it, see the campaign creation flow), so we can't copy any gallery
 * template's box coordinates verbatim — those are only meaningful against
 * that template's own fixed canvas size.
 *
 * Instead, `modernPortrait` (the default template, today's live layout) is
 * read as a set of *proportions* — each box's position/size as a fraction
 * of its own canvas — and those fractions are re-applied to whatever
 * canvas size this campaign actually has. This runs once, at background
 * upload time; after that, the owner's own drag/resize edits are the
 * source of truth.
 */
function scaleBox(box: Box, sourceCanvas: CanvasSize, targetCanvas: CanvasSize): Box {
  return {
    top: Math.round((box.top / sourceCanvas.height) * targetCanvas.height),
    left: Math.round((box.left / sourceCanvas.width) * targetCanvas.width),
    width: Math.round((box.width / sourceCanvas.width) * targetCanvas.width),
    height: Math.round((box.height / sourceCanvas.height) * targetCanvas.height),
  };
}

function scaleTextBox(box: TextBoxConfig, sourceCanvas: CanvasSize, targetCanvas: CanvasSize, fallbackColor: string): TextBoxConfig {
  return {
    ...scaleBox(box, sourceCanvas, targetCanvas),
    // Every free-form campaign layout opts into continuous auto-fit sizing
    // (see TextBoxConfig.autoFit) instead of the source template's
    // shrinkAt threshold — the two are mutually exclusive in practice, so
    // shrinkAt is deliberately not copied over here (it would be dead data:
    // there's no UI to turn autoFit back off once the free-form editor
    // owns a campaign's layout).
    autoFit: true,
    // The source template relies on Name/Role/Message's own component
    // default color when unset (white for name/role, blue for message) —
    // the editor's color picker needs a concrete starting value instead of
    // "no color", so that implicit default becomes an explicit one here.
    textColor: box.textColor ?? fallbackColor,
  };
}

export function getDefaultCampaignLayout(canvas: CanvasSize): CampaignLayout {
  const source = getTemplateById(DEFAULT_TEMPLATE_ID);
  if (!source) {
    throw new Error(`Default template "${DEFAULT_TEMPLATE_ID}" is missing from the gallery`);
  }

  return {
    canvas,
    avatarBox: {
      ...scaleBox(source.avatarBox, source.canvas, canvas),
      // Always circle by default in the free-form editor, regardless of
      // the source template's own shape (diamond isn't offered as a new
      // choice here — see docs/specs/free-form-layout-editor.md).
      shape: 'circle',
    },
    nameBox: scaleTextBox(source.nameBox, source.canvas, canvas, '#ffffff'),
    roleBox: scaleTextBox(source.roleBox, source.canvas, canvas, '#ffffff'),
    messageBox: scaleTextBox(source.messageBox, source.canvas, canvas, '#000000'),
  };
}
