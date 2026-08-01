import { describe, expect, it } from 'vitest';
import { fitTextFontSize } from './fitTextToBox';

// A deterministic fake measurer standing in for real canvas.measureText:
// every character is exactly 0.6x the font size wide, so tests can predict
// exact numbers without depending on real font metrics.
const fakeMeasure = (text: string, fontSizePx: number) => text.length * fontSizePx * 0.6;

describe('fitTextFontSize', () => {
  it('picks a smaller font size for a longer single-line text in the same box', () => {
    const box = { width: 300, height: 100 };
    const shortSize = fitTextFontSize({ text: 'Ann', box, measure: fakeMeasure });
    const longSize = fitTextFontSize({ text: 'A Very Long Full Name Indeed', box, measure: fakeMeasure });

    expect(longSize).toBeLessThan(shortSize);
  });

  it('never returns a size whose measured single-line width exceeds the box width (minus padding)', () => {
    const box = { width: 200, height: 100 };
    const text = 'Nguyễn Văn A rất là dài đây';
    const size = fitTextFontSize({ text, box, measure: fakeMeasure, padding: 8 });

    expect(fakeMeasure(text, size)).toBeLessThanOrEqual(box.width - 8 * 2);
  });

  it('clamps to minFontSize (allowing overflow) when even the smallest size does not fit', () => {
    const box = { width: 10, height: 10 };
    const size = fitTextFontSize({
      text: 'This text is far too long for this tiny box to ever contain',
      box,
      measure: fakeMeasure,
      minFontSize: 10,
    });

    expect(size).toBe(10);
  });

  it('picks a larger font size for a bigger box given the same text', () => {
    const text = 'Đơn vị / Chức vụ';
    const smallBox = fitTextFontSize({ text, box: { width: 150, height: 60 }, measure: fakeMeasure });
    const bigBox = fitTextFontSize({ text, box: { width: 600, height: 200 }, measure: fakeMeasure });

    expect(bigBox).toBeGreaterThan(smallBox);
  });

  it('caps the font size at the box-derived maxFontSize even for very short text', () => {
    const box = { width: 1000, height: 1000 };
    const size = fitTextFontSize({ text: 'Hi', box, measure: fakeMeasure });

    // Default max is min(width, height) * 0.6 = 600 — a two-character
    // string would otherwise measure well within an even larger size.
    expect(size).toBeLessThanOrEqual(600);
  });

  it('caps the font size at an explicit maxFontSize, even when the box is large enough to fit bigger', () => {
    const box = { width: 2000, height: 2000 };
    const size = fitTextFontSize({ text: 'Hi', box, measure: fakeMeasure, maxFontSize: 150 });

    expect(size).toBeLessThanOrEqual(150);
  });

  describe('multiline mode', () => {
    it('wraps onto more lines (and so picks a smaller size) for longer text in a narrow box', () => {
      const box = { width: 200, height: 300 };
      const shortSize = fitTextFontSize({ text: 'Short message', box, measure: fakeMeasure, multiline: true });
      const longSize = fitTextFontSize({
        text: 'This is a considerably longer tribute message with many more words in it than the short one',
        box,
        measure: fakeMeasure,
        multiline: true,
      });

      expect(longSize).toBeLessThanOrEqual(shortSize);
    });

    it('respects box height as a ceiling on total wrapped text height', () => {
      const box = { width: 150, height: 80 };
      const text = 'A moderately long tribute message that should wrap across several lines in a narrow box';
      const size = fitTextFontSize({ text, box, measure: fakeMeasure, multiline: true, lineHeight: 1.2, padding: 4 });

      // Re-simulate wrapping at the returned size to confirm it actually fits.
      const words = text.split(' ');
      const availableWidth = box.width - 4 * 2;
      let lines = 1;
      let lineWidth = 0;
      for (const word of words) {
        const wordWidth = fakeMeasure(`${word} `, size);
        if (lineWidth + wordWidth > availableWidth && lineWidth > 0) {
          lines += 1;
          lineWidth = wordWidth;
        } else {
          lineWidth += wordWidth;
        }
      }
      expect(lines * size * 1.2).toBeLessThanOrEqual(box.height - 4 * 2);
    });
  });
});
