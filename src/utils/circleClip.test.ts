import { describe, expect, it } from 'vitest';
import { angleFromPoint, buildChordClipPath, buildChordSegment, pointOnCircle } from './circleClip';

describe('pointOnCircle / angleFromPoint (drag-handle math)', () => {
  it('places 0deg at top-center, 90deg at right-center, 180deg at bottom-center, 270deg at left-center', () => {
    const expectPoint = (angle: number, x: number, y: number) => {
      const point = pointOnCircle(100, 100, angle);
      expect(point.x).toBeCloseTo(x);
      expect(point.y).toBeCloseTo(y);
    };
    expectPoint(0, 50, 0);
    expectPoint(90, 100, 50);
    expectPoint(180, 50, 100);
    expectPoint(270, 0, 50);
  });

  it('angleFromPoint is the inverse of pointOnCircle', () => {
    for (const angle of [0, 37, 90, 123, 180, 200, 270, 359]) {
      const { x, y } = pointOnCircle(100, 100, angle);
      expect(angleFromPoint(100, 100, x, y)).toBeCloseTo(angle === 359 ? 359 : angle);
    }
  });
});

describe('buildChordSegment', () => {
  it('a horizontal cut through the exact center is a true half circle (90deg endpoints)', () => {
    const segment = buildChordSegment(100, 100, 'horizontal', 0.5, false);
    // left/right intersection points of a horizontal line through the center
    expect(segment.start).toEqual({ x: 0, y: 50 });
    expect(segment.end).toEqual({ x: 100, y: 50 });
    expect(segment.sweep).toBeCloseTo(180);
  });

  it('a vertical cut through the exact center is a true half circle', () => {
    const segment = buildChordSegment(100, 100, 'vertical', 0.5, false);
    expect(segment.start).toEqual({ x: 50, y: 100 });
    expect(segment.end).toEqual({ x: 50, y: 0 });
    expect(segment.sweep).toBeCloseTo(180);
  });

  it('horizontal, ratio > 0.5 (line pushed below center), keepEnd=false keeps the larger top cap (sweep > 180)', () => {
    const segment = buildChordSegment(100, 100, 'horizontal', 0.75, false);
    expect(segment.sweep).toBeGreaterThan(180);
  });

  it('horizontal, ratio > 0.5, keepEnd=true keeps the smaller bottom cap (sweep < 180)', () => {
    const segment = buildChordSegment(100, 100, 'horizontal', 0.75, true);
    expect(segment.sweep).toBeLessThan(180);
  });

  it('vertical, ratio < 0.5 (line pushed left of center), keepEnd=false (keep left) yields the smaller cap', () => {
    const segment = buildChordSegment(100, 100, 'vertical', 0.25, false);
    expect(segment.sweep).toBeLessThan(180);
  });

  it('flipping keepEnd swaps start/end (mirrors which side is kept) without changing the cut line itself', () => {
    const top = buildChordSegment(100, 100, 'horizontal', 0.3, false);
    const bottom = buildChordSegment(100, 100, 'horizontal', 0.3, true);
    expect(top.start).toEqual(bottom.end);
    expect(top.end).toEqual(bottom.start);
  });
});

describe('buildChordClipPath', () => {
  it('returns a path() wrapped SVG path string', () => {
    const result = buildChordClipPath(100, 100, 'horizontal', 0.5, false);
    expect(result).toMatch(/^path\('.*'\)$/);
  });

  it('uses a large-arc-flag consistent with the segment sweep', () => {
    const majorityKept = buildChordClipPath(100, 100, 'horizontal', 0.75, false);
    expect(majorityKept).toContain('A 50 50 0 1 1');

    const minorityKept = buildChordClipPath(100, 100, 'horizontal', 0.75, true);
    expect(minorityKept).toContain('A 50 50 0 0 1');
  });
});
