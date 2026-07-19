import { describe, expect, it } from 'vitest';

import { buildCustomFontFamilyName, customFontFormatForFileName } from './customFont';

describe('customFontFormatForFileName', () => {
  it('resolves woff2/ttf/otf extensions to their CustomFontFormat', () => {
    expect(customFontFormatForFileName('brand.woff2')).toBe('woff2');
    expect(customFontFormatForFileName('brand.ttf')).toBe('truetype');
    expect(customFontFormatForFileName('brand.otf')).toBe('opentype');
  });

  it('is case-insensitive on the extension', () => {
    expect(customFontFormatForFileName('Brand.WOFF2')).toBe('woff2');
  });

  it('returns null for an unsupported extension', () => {
    expect(customFontFormatForFileName('brand.eot')).toBeNull();
    expect(customFontFormatForFileName('brand')).toBeNull();
  });
});

describe('buildCustomFontFamilyName', () => {
  it('produces a CSS-safe, prefixed family name derived from the filename', () => {
    const family = buildCustomFontFamilyName('My Brand Font!.woff2');
    expect(family).toMatch(/^custom-my-brand-font-[a-z0-9]+$/);
  });

  it('produces a different name on each call, so two uploads never collide', () => {
    const first = buildCustomFontFamilyName('brand.woff2');
    const second = buildCustomFontFamilyName('brand.woff2');
    expect(first).not.toBe(second);
  });
});
