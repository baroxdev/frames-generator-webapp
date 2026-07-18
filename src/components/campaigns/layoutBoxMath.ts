import type { Box, CanvasSize } from '../../templates/types';

/**
 * Keeps a box fully inside the canvas after a drag or resize (decided:
 * clamp to canvas bounds, no minimum size, no overlap prevention — see
 * docs/specs/free-form-layout-editor.md). Size is clamped first, then
 * position against the (possibly now-smaller) size, so a box dragged past
 * an edge while also larger than the canvas still ends up fully on-canvas
 * rather than just having its overflow direction fixed.
 */
export function clampBoxToCanvas(box: Box, canvas: CanvasSize): Box {
  const width = Math.min(box.width, canvas.width);
  const height = Math.min(box.height, canvas.height);
  const left = Math.min(Math.max(box.left, 0), canvas.width - width);
  const top = Math.min(Math.max(box.top, 0), canvas.height - height);

  return { top, left, width, height };
}
