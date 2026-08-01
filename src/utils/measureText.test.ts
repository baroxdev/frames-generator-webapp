import { describe, expect, it } from 'vitest';
import { measureTextWidth } from './measureText';

// jsdom throws on canvas.getContext('2d') (no native canvas support in this
// test environment — see docs/specs/free-form-layout-editor.md's testing
// note), so every call here exercises the crude per-character fallback, not
// real canvas.measureText. That's fine: these tests only assert the
// fallback's shape (positive, monotonic), not exact pixel values.
describe('measureTextWidth', () => {
  it('returns a positive width for non-empty text', () => {
    expect(measureTextWidth('Nguyễn Văn A', '700 24px sans-serif')).toBeGreaterThan(0);
  });

  it('returns 0 for empty text', () => {
    expect(measureTextWidth('', '700 24px sans-serif')).toBe(0);
  });

  it('grows with longer text at the same font size', () => {
    const short = measureTextWidth('Ann', '700 24px sans-serif');
    const long = measureTextWidth('Annabelle Nguyễn', '700 24px sans-serif');
    expect(long).toBeGreaterThan(short);
  });

  it('grows with a larger font size for the same text', () => {
    const small = measureTextWidth('Nguyễn Văn A', '700 16px sans-serif');
    const large = measureTextWidth('Nguyễn Văn A', '700 32px sans-serif');
    expect(large).toBeGreaterThan(small);
  });
});
