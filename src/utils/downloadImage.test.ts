import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { downloadImage } from './downloadImage';

describe('downloadImage', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it('fetches the image, creates a blob URL, and clicks a download link', async () => {
    const blob = new Blob(['image bytes']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));

    await downloadImage('https://cdn.example.com/a.jpg', 'nguyen-van-a.jpg');

    expect(fetch).toHaveBeenCalledWith('https://cdn.example.com/a.jpg');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('throws a friendly error when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const error = await downloadImage('https://cdn.example.com/a.jpg', 'a.jpg').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('404');
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
