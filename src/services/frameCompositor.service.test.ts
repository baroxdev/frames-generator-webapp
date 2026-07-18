import { describe, expect, it, vi } from 'vitest';

const { mockDomToBlob } = vi.hoisted(() => ({ mockDomToBlob: vi.fn() }));

vi.mock('modern-screenshot', () => ({ domToBlob: mockDomToBlob }));

import { compositeFrameToBlob } from './frameCompositor.service';

describe('compositeFrameToBlob', () => {
  it('rasterizes the given node into a JPEG blob with font embedding enabled', async () => {
    const blob = new Blob(['fake-image'], { type: 'image/jpeg' });
    mockDomToBlob.mockResolvedValue(blob);
    const node = document.createElement('div');

    const result = await compositeFrameToBlob(node);

    expect(mockDomToBlob).toHaveBeenCalledWith(
      node,
      expect.objectContaining({ type: 'image/jpeg', quality: 0.9, scale: 2, font: {} }),
    );
    expect(result).toBe(blob);
  });
});
