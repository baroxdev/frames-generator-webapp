import { describe, expect, it } from 'vitest';

import { CURATED_FONTS, cssFontFamily, DEFAULT_FONT_FAMILY, getCuratedFont } from './fonts';

describe('CURATED_FONTS', () => {
  it('has a spread of at least 15 curated fonts', () => {
    expect(CURATED_FONTS.length).toBeGreaterThanOrEqual(15);
  });

  it('never has two entries for the same family', () => {
    const families = CURATED_FONTS.map((font) => font.family);
    expect(new Set(families).size).toBe(families.length);
  });

  it('every entry requests at least weight 400 in its Google Fonts href', () => {
    for (const font of CURATED_FONTS) {
      expect(font.googleFontsHref).toContain('wght@');
      expect(font.googleFontsHref).toMatch(/400/);
      expect(font.googleFontsHref).toContain(font.family.replace(/ /g, '+'));
    }
  });

  it('includes DEFAULT_FONT_FAMILY as one of the curated entries', () => {
    expect(CURATED_FONTS.some((font) => font.family === DEFAULT_FONT_FAMILY)).toBe(true);
  });
});

describe('getCuratedFont', () => {
  it('returns the matching curated font for a known family', () => {
    const font = getCuratedFont('Playfair Display');
    expect(font.family).toBe('Playfair Display');
    expect(font.category).toBe('serif');
  });

  it('falls back to the house default for an unrecognized family', () => {
    const font = getCuratedFont('Some Removed Font');
    expect(font.family).toBe(DEFAULT_FONT_FAMILY);
  });

  it('falls back to the house default when family is undefined', () => {
    const font = getCuratedFont(undefined);
    expect(font.family).toBe(DEFAULT_FONT_FAMILY);
  });
});

describe('cssFontFamily', () => {
  it('quotes the family name and appends the category fallback', () => {
    expect(cssFontFamily('Lobster')).toBe("'Lobster', cursive");
    expect(cssFontFamily('Playfair Display')).toBe("'Playfair Display', serif");
    expect(cssFontFamily('Roboto')).toBe("'Roboto', sans-serif");
  });

  it('falls back to the house default for an unrecognized family', () => {
    expect(cssFontFamily('Not A Real Font')).toBe(cssFontFamily(DEFAULT_FONT_FAMILY));
  });

  it('uses the family verbatim (with a generic fallback) when isCustomFont is true, instead of looking it up in the curated list', () => {
    expect(cssFontFamily('custom-my-font-ab12cd', true)).toBe("'custom-my-font-ab12cd', sans-serif");
  });

  it('ignores isCustomFont when family is undefined, falling back to the house default like normal', () => {
    expect(cssFontFamily(undefined, true)).toBe(cssFontFamily(DEFAULT_FONT_FAMILY));
  });
});
