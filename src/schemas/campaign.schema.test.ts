import { describe, expect, it } from 'vitest';
import { campaignLayoutRowSchema, campaignLayoutSchema, createCampaignSchema, slugField } from './campaign.schema';

const VALID_LAYOUT = {
  canvas: { width: 1500, height: 843 },
  avatarBox: { top: 100, left: 100, width: 200, height: 200, shape: 'circle' as const },
  nameBox: { top: 500, left: 100, width: 300, height: 40, textColor: '#ffffff' },
  roleBox: { top: 550, left: 100, width: 300, height: 40, textColor: '#ffffff' },
  messageBox: { top: 100, left: 500, width: 800, height: 400, textColor: '#000000' },
};

describe('slugField', () => {
  it.each(['dai-hoi-ben-tre', 'abc', 'a1-b2-c3', 'daihoitinhbentre'])('accepts %s', (slug) => {
    expect(slugField.safeParse(slug).success).toBe(true);
  });

  it.each([
    ['ab', 'too short'],
    ['a'.repeat(51), 'too long'],
    ['Dai-Hoi', 'uppercase letters'],
    ['dai_hoi', 'underscore instead of hyphen'],
    ['-dai-hoi', 'leading hyphen'],
    ['dai-hoi-', 'trailing hyphen'],
    ['dai--hoi', 'double hyphen'],
    ['dai hoi', 'space'],
  ])('rejects %s (%s)', (slug) => {
    expect(slugField.safeParse(slug).success).toBe(false);
  });
});

describe('createCampaignSchema', () => {
  it('accepts a valid slug and layout', () => {
    const result = createCampaignSchema.safeParse({ slug: 'dai-hoi-ben-tre', layout: VALID_LAYOUT });
    expect(result.success).toBe(true);
  });

  it('rejects a missing layout', () => {
    const result = createCampaignSchema.safeParse({ slug: 'dai-hoi-ben-tre' });
    expect(result.success).toBe(false);
  });
});

describe('campaignLayoutSchema', () => {
  it('accepts a valid layout', () => {
    expect(campaignLayoutSchema.safeParse(VALID_LAYOUT).success).toBe(true);
  });

  it('rejects an avatar shape outside circle/square (the free-form editor only offers those two)', () => {
    const result = campaignLayoutSchema.safeParse({
      ...VALID_LAYOUT,
      avatarBox: { ...VALID_LAYOUT.avatarBox, shape: 'diamond' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive box width/height', () => {
    const result = campaignLayoutSchema.safeParse({
      ...VALID_LAYOUT,
      messageBox: { ...VALID_LAYOUT.messageBox, width: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative box position', () => {
    const result = campaignLayoutSchema.safeParse({
      ...VALID_LAYOUT,
      nameBox: { ...VALID_LAYOUT.nameBox, top: -5 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a text box missing textColor', () => {
    const roleBoxWithoutColor: Record<string, unknown> = { ...VALID_LAYOUT.roleBox };
    delete roleBoxWithoutColor.textColor;
    const result = campaignLayoutSchema.safeParse({ ...VALID_LAYOUT, roleBox: roleBoxWithoutColor });
    expect(result.success).toBe(false);
  });

  it('rejects a box that extends past the right/bottom edge of its own canvas', () => {
    const result = campaignLayoutSchema.safeParse({
      ...VALID_LAYOUT,
      messageBox: { ...VALID_LAYOUT.messageBox, left: 1400, width: 800 }, // 1400+800 > canvas width 1500
    });
    expect(result.success).toBe(false);
  });
});

describe('campaignLayoutRowSchema', () => {
  it('accepts everything campaignLayoutSchema accepts', () => {
    expect(campaignLayoutRowSchema.safeParse(VALID_LAYOUT).success).toBe(true);
  });

  it('accepts an avatar shape of diamond, for campaigns created before the free-form editor existed', () => {
    const result = campaignLayoutRowSchema.safeParse({
      ...VALID_LAYOUT,
      avatarBox: { ...VALID_LAYOUT.avatarBox, shape: 'diamond' },
    });
    expect(result.success).toBe(true);
  });
});
