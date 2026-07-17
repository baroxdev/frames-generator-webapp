import { describe, expect, it } from 'vitest';

import { doBoxesOverlap, effectiveAvatarBox, findOverlappingBoxes } from '../boxOverlap';

describe('doBoxesOverlap', () => {
  it('is false for boxes that do not intersect at all', () => {
    const a = { top: 0, left: 0, width: 100, height: 100 };
    const b = { top: 200, left: 200, width: 100, height: 100 };
    expect(doBoxesOverlap(a, b)).toBe(false);
  });

  it('is false for boxes that only touch at a shared edge', () => {
    const a = { top: 0, left: 0, width: 100, height: 100 };
    const b = { top: 100, left: 0, width: 100, height: 100 }; // starts exactly where a ends
    expect(doBoxesOverlap(a, b)).toBe(false);
  });

  it('is true for boxes whose interiors intersect', () => {
    const a = { top: 0, left: 0, width: 100, height: 100 };
    const b = { top: 50, left: 50, width: 100, height: 100 };
    expect(doBoxesOverlap(a, b)).toBe(true);
  });

  it('is true when one box is fully inside another', () => {
    const a = { top: 0, left: 0, width: 200, height: 200 };
    const b = { top: 50, left: 50, width: 10, height: 10 };
    expect(doBoxesOverlap(a, b)).toBe(true);
  });

  it('is order-independent', () => {
    const a = { top: 0, left: 0, width: 100, height: 100 };
    const b = { top: 50, left: 50, width: 100, height: 100 };
    expect(doBoxesOverlap(a, b)).toBe(doBoxesOverlap(b, a));
  });
});

describe('findOverlappingBoxes', () => {
  it('returns an empty list when nothing overlaps', () => {
    const boxes = [
      { name: 'avatar', box: { top: 0, left: 0, width: 100, height: 100 } },
      { name: 'name', box: { top: 200, left: 0, width: 100, height: 100 } },
      { name: 'role', box: { top: 300, left: 0, width: 100, height: 100 } },
    ];
    expect(findOverlappingBoxes(boxes)).toEqual([]);
  });

  it('names every overlapping pair', () => {
    const boxes = [
      { name: 'avatar', box: { top: 0, left: 0, width: 100, height: 100 } },
      { name: 'name', box: { top: 50, left: 50, width: 100, height: 100 } },
      { name: 'role', box: { top: 500, left: 500, width: 10, height: 10 } },
    ];
    expect(findOverlappingBoxes(boxes)).toEqual([{ a: 'avatar', b: 'name' }]);
  });
});

describe('effectiveAvatarBox', () => {
  it('returns circle/square avatar boxes unchanged — no rotation is applied to them', () => {
    const box = { top: 10, left: 20, width: 100, height: 100, shape: 'circle' as const };
    expect(effectiveAvatarBox(box)).toEqual({ top: 10, left: 20, width: 100, height: 100 });
  });

  it('inflates a diamond avatar box to its true rotated (45deg) visual footprint', () => {
    // Avatar.tsx renders 'diamond' by rotating a WxH box 45deg around its own
    // center, which is how CSS transforms behave — the box's *layout*
    // position/size stays WxH, but its *painted* footprint grows to a
    // W*sqrt(2) x H*sqrt(2) diamond centered on the same point. Overlap
    // checks need that painted footprint, not the pre-rotation box, or a
    // diamond avatar could visually collide with a neighboring box while
    // still "passing" as non-overlapping on paper.
    const box = { top: 200, left: 100, width: 200, height: 200, shape: 'diamond' as const };
    const result = effectiveAvatarBox(box);

    const expectedSide = 200 * Math.SQRT2;
    const expectedInset = (expectedSide - 200) / 2;

    expect(result.width).toBeCloseTo(expectedSide, 5);
    expect(result.height).toBeCloseTo(expectedSide, 5);
    expect(result.top).toBeCloseTo(200 - expectedInset, 5);
    expect(result.left).toBeCloseTo(100 - expectedInset, 5);
  });

  it('keeps the diamond box centered on the same point as the original box', () => {
    const box = { top: 200, left: 100, width: 200, height: 200, shape: 'diamond' as const };
    const original = { centerTop: box.top + box.height / 2, centerLeft: box.left + box.width / 2 };

    const result = effectiveAvatarBox(box);
    const inflated = { centerTop: result.top + result.height / 2, centerLeft: result.left + result.width / 2 };

    expect(inflated.centerTop).toBeCloseTo(original.centerTop, 5);
    expect(inflated.centerLeft).toBeCloseTo(original.centerLeft, 5);
  });
});
