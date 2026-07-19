import { describe, expect, it } from 'vitest';

import { buildFontString, MESSAGE_FONT_WEIGHT, NAME_ROLE_FONT_WEIGHT } from './textFonts';

describe('buildFontString', () => {
  it('builds a CSS font shorthand string from weight, size, and a pre-built family value', () => {
    expect(buildFontString(700, 32, "'Roboto', sans-serif")).toBe("700 32px 'Roboto', sans-serif");
  });

  it('uses the given weight and size verbatim, not the name/role/message constants', () => {
    expect(buildFontString(NAME_ROLE_FONT_WEIGHT, 24, "'Lora', serif")).toBe("700 24px 'Lora', serif");
    expect(buildFontString(MESSAGE_FONT_WEIGHT, 40, "'Lora', serif")).toBe("500 40px 'Lora', serif");
  });
});
