/** Measures a string's rendered width at a given font size (px), for a fixed font-family/weight the caller has already baked in. */
export type MeasureTextWidth = (text: string, fontSizePx: number) => number;

export type FitTextOptions = {
  text: string;
  box: { width: number; height: number };
  measure: MeasureTextWidth;
  /** Name/role never wrap (single line); message does. Defaults to single-line. */
  multiline?: boolean;
  /** Text this small is unreadable regardless of what "fits" — never returned even if a smaller size would fit better. */
  minFontSize?: number;
  /** Defaults to a fraction of the box's own smaller dimension, so a bigger box allows bigger text. */
  maxFontSize?: number;
  /** Multiplied by font size to get one line's rendered height (matches typical CSS line-height). */
  lineHeight?: number;
  /** Horizontal/vertical buffer (px) so text doesn't touch the box edges. */
  padding?: number;
};

const DEFAULT_MIN_FONT_SIZE = 10;
const DEFAULT_LINE_HEIGHT = 1.2;
const DEFAULT_PADDING = 8;
const DEFAULT_MAX_FONT_SIZE_FACTOR = 0.6;

function countWrappedLines(text: string, fontSizePx: number, availableWidth: number, measure: MeasureTextWidth): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const wordWidth = measure(`${word} `, fontSizePx);
    if (lineWidth + wordWidth > availableWidth && lineWidth > 0) {
      lines += 1;
      lineWidth = wordWidth;
    } else {
      lineWidth += wordWidth;
    }
  }
  return lines;
}

/**
 * Binary-searches the largest font size (in whole px) at which `text`
 * actually fits inside `box`, using real measured widths (`measure`) rather
 * than a character-count formula — see docs/specs/free-form-layout-editor.md's
 * font-size section for why. Single-line boxes (name/role) just check
 * measured width; multiline (message) simulates word-wrap to count lines
 * and checks total wrapped height against the box.
 *
 * Never returns less than `minFontSize`, even if the text still overflows
 * at that size (a tiny box with a very long text is the owner's problem to
 * notice and fix, not something to silently break on — same philosophy as
 * this editor's "no minimum box size" decision).
 */
export function fitTextFontSize({
  text,
  box,
  measure,
  multiline = false,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  maxFontSize,
  lineHeight = DEFAULT_LINE_HEIGHT,
  padding = DEFAULT_PADDING,
}: FitTextOptions): number {
  const availableWidth = Math.max(box.width - padding * 2, 1);
  const availableHeight = Math.max(box.height - padding * 2, 1);
  const upperBound = Math.max(maxFontSize ?? Math.min(box.width, box.height) * DEFAULT_MAX_FONT_SIZE_FACTOR, minFontSize);

  function fits(fontSizePx: number): boolean {
    if (multiline) {
      const lines = countWrappedLines(text, fontSizePx, availableWidth, measure);
      return lines * fontSizePx * lineHeight <= availableHeight;
    }
    return measure(text, fontSizePx) <= availableWidth && fontSizePx * lineHeight <= availableHeight;
  }

  if (!fits(minFontSize)) {
    return minFontSize;
  }

  let low = minFontSize;
  let high = Math.floor(upperBound);
  let best = low;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}
