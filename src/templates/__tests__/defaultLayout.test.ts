import { describe, expect, it } from 'vitest';

import { effectiveAvatarBox, findOverlappingBoxes } from '../boxOverlap';
import { getDefaultCampaignLayout } from '../defaultLayout';
import { DEFAULT_TEMPLATE_ID, getTemplateById } from '../gallery';

describe('getDefaultCampaignLayout', () => {
  it('scales modernPortrait proportions to the given canvas size', () => {
    const source = getTemplateById(DEFAULT_TEMPLATE_ID);
    if (!source) throw new Error('modernPortrait is missing from the gallery');
    // Double every dimension of modernPortrait's own canvas — every box
    // should come back at exactly double its source position/size too,
    // since the conversion is a straight proportional scale.
    const canvas = { width: source.canvas.width * 2, height: source.canvas.height * 2 };

    const layout = getDefaultCampaignLayout(canvas);

    expect(layout.canvas).toEqual(canvas);
    expect(layout.avatarBox).toMatchObject({
      top: source.avatarBox.top * 2,
      left: source.avatarBox.left * 2,
      width: source.avatarBox.width * 2,
      height: source.avatarBox.height * 2,
    });
    expect(layout.messageBox).toMatchObject({
      top: source.messageBox.top * 2,
      left: source.messageBox.left * 2,
      width: source.messageBox.width * 2,
      height: source.messageBox.height * 2,
    });
  });

  it('always defaults the avatar shape to circle, regardless of the source template', () => {
    const layout = getDefaultCampaignLayout({ width: 1200, height: 900 });
    expect(layout.avatarBox.shape).toBe('circle');
  });

  it('gives every text box a concrete default color (never leaves it undefined)', () => {
    const layout = getDefaultCampaignLayout({ width: 1200, height: 900 });
    expect(layout.nameBox.textColor).toBeTruthy();
    expect(layout.roleBox.textColor).toBeTruthy();
    expect(layout.messageBox.textColor).toBeTruthy();
  });

  it('keeps every box fully inside the resulting canvas, for a canvas of a very different aspect ratio', () => {
    const canvas = { width: 2000, height: 500 };
    const layout = getDefaultCampaignLayout(canvas);

    for (const box of [
      effectiveAvatarBox(layout.avatarBox),
      layout.nameBox,
      layout.roleBox,
      layout.messageBox,
    ]) {
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top + box.height).toBeLessThanOrEqual(canvas.height);
      expect(box.left + box.width).toBeLessThanOrEqual(canvas.width);
    }
  });

  it('produces no overlap between the four default boxes', () => {
    const canvas = { width: 1500, height: 843 };
    const layout = getDefaultCampaignLayout(canvas);

    const overlaps = findOverlappingBoxes([
      { name: 'avatar', box: effectiveAvatarBox(layout.avatarBox) },
      { name: 'name', box: layout.nameBox },
      { name: 'role', box: layout.roleBox },
      { name: 'message', box: layout.messageBox },
    ]);

    expect(overlaps).toEqual([]);
  });
});
