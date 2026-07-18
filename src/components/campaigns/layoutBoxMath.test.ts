import { describe, expect, it } from 'vitest';
import { clampBoxToCanvas } from './layoutBoxMath';

const CANVAS = { width: 1000, height: 500 };

describe('clampBoxToCanvas', () => {
  it('leaves a box that already fits fully inside the canvas unchanged', () => {
    const box = { top: 100, left: 100, width: 200, height: 100 };
    expect(clampBoxToCanvas(box, CANVAS)).toEqual(box);
  });

  it('pulls a box back inside when dragged past the left/top edge', () => {
    const box = { top: -20, left: -30, width: 200, height: 100 };
    expect(clampBoxToCanvas(box, CANVAS)).toEqual({ top: 0, left: 0, width: 200, height: 100 });
  });

  it('pulls a box back inside when dragged past the right/bottom edge', () => {
    const box = { top: 480, left: 950, width: 200, height: 100 };
    expect(clampBoxToCanvas(box, CANVAS)).toEqual({ top: 400, left: 800, width: 200, height: 100 });
  });

  it('shrinks a box that is wider/taller than the whole canvas down to fit, pinned at the origin', () => {
    const box = { top: 0, left: 0, width: 1200, height: 600 };
    expect(clampBoxToCanvas(box, CANVAS)).toEqual({ top: 0, left: 0, width: 1000, height: 500 });
  });

  it('clamps position after clamping size, so an oversized box dragged off-edge still ends up fully inside', () => {
    const box = { top: 450, left: 900, width: 1200, height: 600 };
    expect(clampBoxToCanvas(box, CANVAS)).toEqual({ top: 0, left: 0, width: 1000, height: 500 });
  });
});
