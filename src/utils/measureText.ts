let sharedContext: CanvasRenderingContext2D | null | undefined;

/**
 * A single hidden `<canvas>` 2D context, reused for every measurement
 * (creating one per call would be wasteful — `ctx.font` is cheap to swap
 * per measurement instead). `undefined` means "not yet attempted",
 * `null` means "attempted and unavailable" (e.g. jsdom in tests, which
 * throws rather than returning a context) — cached either way so the
 * fallback path below doesn't retry a failing `getContext` on every call.
 */
function getSharedContext(): CanvasRenderingContext2D | null {
  if (sharedContext !== undefined) return sharedContext;
  try {
    sharedContext = document.createElement('canvas').getContext('2d');
  } catch {
    sharedContext = null;
  }
  return sharedContext;
}

/**
 * Real, exact text width at a given font, via canvas `measureText` — used
 * by both the free-form layout editor (Konva, which already draws to a
 * real canvas) and the production `Name`/`Role`/`Message` components when
 * `autoFit` is set, so sizing behaves identically in both places. Falls
 * back to a crude per-character estimate if no canvas context is available
 * at all (e.g. a test environment without native canvas support) — good
 * enough to keep auto-fit's relative behavior (longer text -> smaller
 * size) correct even where real measurement isn't possible.
 */
export function measureTextWidth(text: string, font: string): number {
  const ctx = getSharedContext();
  if (!ctx) {
    const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
    const fontSizePx = fontSizeMatch ? Number(fontSizeMatch[1]) : 16;
    return text.length * fontSizePx * 0.55;
  }
  ctx.font = font;
  return ctx.measureText(text).width;
}
