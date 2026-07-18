import { describe, expect, it, vi } from 'vitest';

const { mockHtml2Canvas } = vi.hoisted(() => ({ mockHtml2Canvas: vi.fn() }));

vi.mock('html2canvas-pro', () => ({ default: mockHtml2Canvas }));

import { compositeFrameToDataUrl } from './frameCompositor.service';

describe('compositeFrameToDataUrl', () => {
  it('rasterizes the given node and returns a JPEG data URL', async () => {
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,xyz');
    mockHtml2Canvas.mockResolvedValue({ toDataURL });
    const node = document.createElement('div');

    const result = await compositeFrameToDataUrl(node, 1500);

    expect(mockHtml2Canvas).toHaveBeenCalledWith(
      node,
      expect.objectContaining({ useCORS: true, allowTaint: true, scale: 2 }),
    );
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
    expect(result).toBe('data:image/jpeg;base64,xyz');
  });

  it('uses a window width wide enough for the canvas', async () => {
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,xyz');
    mockHtml2Canvas.mockResolvedValue({ toDataURL });
    const node = document.createElement('div');

    await compositeFrameToDataUrl(node, 2000);

    expect(mockHtml2Canvas).toHaveBeenCalledWith(node, expect.objectContaining({ windowWidth: 2428 }));
  });
});
