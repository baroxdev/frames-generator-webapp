import { describe, expect, it } from 'vitest';
import { computeDownscaleTarget } from './resizeImageIfOversized';

describe('computeDownscaleTarget', () => {
  it('returns null when the image is already within the limit', () => {
    expect(computeDownscaleTarget(1920, 1080, 2400)).toBeNull();
  });

  it('returns null when the longer side exactly equals the limit', () => {
    expect(computeDownscaleTarget(2400, 1000, 2400)).toBeNull();
  });

  it('scales both dimensions down proportionally so the longer side matches the limit', () => {
    const target = computeDownscaleTarget(13334, 7500, 2400);

    expect(target).not.toBeNull();
    expect(target!.width).toBe(2400);
    // 7500 * (2400 / 13334), rounded.
    expect(target!.height).toBe(1350);
  });

  it('treats height as the longer side when the image is portrait', () => {
    const target = computeDownscaleTarget(3000, 8000, 2400);

    expect(target).not.toBeNull();
    expect(target!.height).toBe(2400);
    expect(target!.width).toBe(900);
  });

  it('never returns a dimension of 0 for an extreme aspect ratio', () => {
    const target = computeDownscaleTarget(20000, 5, 2400);

    expect(target).not.toBeNull();
    expect(target!.height).toBeGreaterThanOrEqual(1);
  });
});
