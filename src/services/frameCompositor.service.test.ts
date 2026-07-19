import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDomToBlob, mockEnsureFontReady } = vi.hoisted(() => ({
  mockDomToBlob: vi.fn(),
  mockEnsureFontReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('modern-screenshot', () => ({ domToBlob: mockDomToBlob }));
vi.mock('../utils/loadGoogleFont', () => ({ ensureFontReady: mockEnsureFontReady }));

import { compositeFrameToBlob, computeExportScale } from './frameCompositor.service';

beforeEach(() => {
  mockDomToBlob.mockReset();
  mockEnsureFontReady.mockReset().mockResolvedValue(undefined);
});

/** jsdom never actually lays out elements, so offsetWidth/offsetHeight stay 0 unless stubbed — this simulates a node whose rendered box is a given canvas size. */
function nodeWithSize(width: number, height: number): HTMLElement {
  const node = document.createElement('div');
  Object.defineProperty(node, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: height, configurable: true });
  return node;
}

describe('computeExportScale', () => {
  it('falls back to the max scale (2x) when the node has no measurable size (e.g. not yet laid out)', () => {
    const node = document.createElement('div');
    expect(computeExportScale(node)).toBe(2);
  });

  it('scales up a small canvas to the max scale (2x), not all the way to the long-edge target', () => {
    // 800x600 * 2 = 1600 long edge, well under the 2048 target — capping at
    // 2x avoids pointless supersampling for a canvas this size.
    expect(computeExportScale(nodeWithSize(800, 600))).toBe(2);
  });

  it('scales a canvas near the old default template size down from the previous flat 2x, landing exactly on the long-edge target', () => {
    const scale = computeExportScale(nodeWithSize(1500, 843));
    expect(scale).toBeCloseTo(2048 / 1500, 5);
    expect(1500 * scale).toBeCloseTo(2048, 0);
  });

  it('scales a large free-form canvas down so its long edge lands at the target instead of exploding in file size', () => {
    const scale = computeExportScale(nodeWithSize(5555, 3124));
    expect(5555 * scale).toBeCloseTo(2048, 0);
    expect(scale).toBeLessThan(1);
  });

  it('uses the taller dimension as the long edge for a portrait canvas', () => {
    const scale = computeExportScale(nodeWithSize(1000, 4000));
    expect(4000 * scale).toBeCloseTo(2048, 0);
  });
});

describe('compositeFrameToBlob', () => {
  it('rasterizes the given node into a JPEG blob, scaled to fit the long-edge export target', async () => {
    const blob = new Blob(['fake-image'], { type: 'image/jpeg' });
    mockDomToBlob.mockResolvedValue(blob);
    const node = nodeWithSize(1500, 843);

    const result = await compositeFrameToBlob(node);

    expect(mockDomToBlob).toHaveBeenCalledWith(
      node,
      expect.objectContaining({ type: 'image/jpeg', quality: 0.9, scale: computeExportScale(node), font: {} }),
    );
    expect(result).toBe(blob);
  });

  it("waits for the campaign's font to actually be ready before rasterizing, not just requesting it", async () => {
    mockDomToBlob.mockResolvedValue(new Blob(['fake-image'], { type: 'image/jpeg' }));
    let resolveFontReady!: () => void;
    mockEnsureFontReady.mockReturnValue(new Promise<void>((resolve) => (resolveFontReady = resolve)));
    const node = nodeWithSize(1500, 843);

    let settled = false;
    const promise = compositeFrameToBlob(node, 'Lobster').then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(mockDomToBlob).not.toHaveBeenCalled();
    expect(settled).toBe(false);

    resolveFontReady();
    await promise;

    expect(settled).toBe(true);
    expect(mockDomToBlob).toHaveBeenCalledTimes(1);
  });

  it('requests readiness for both the name/role weight and the message weight of the given fontFamily', async () => {
    mockEnsureFontReady.mockResolvedValue(undefined);
    mockDomToBlob.mockResolvedValue(new Blob(['fake-image'], { type: 'image/jpeg' }));

    await compositeFrameToBlob(nodeWithSize(1500, 843), 'Lobster');

    expect(mockEnsureFontReady).toHaveBeenCalledWith('Lobster', 700, undefined);
    expect(mockEnsureFontReady).toHaveBeenCalledWith('Lobster', 500, undefined);
  });
});
