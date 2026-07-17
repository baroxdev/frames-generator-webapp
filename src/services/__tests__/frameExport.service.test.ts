import { describe, expect, it } from 'vitest';

import { getExportWindowWidth } from '../frameExport.service';

describe('getExportWindowWidth', () => {
  it('reproduces the original hardcoded 1928 for the 1500px-wide gallery templates', () => {
    expect(getExportWindowWidth(1500)).toBe(1928);
  });

  it('scales up for a wider template canvas so its content is never clipped mid-capture', () => {
    expect(getExportWindowWidth(2000)).toBe(2428);
  });

  it('never goes below a width safely clear of the app’s max-md (768px) breakpoint', () => {
    // A tiny canvas must not produce a windowWidth that would make
    // html2canvas's virtual layout treat the card as "mobile" and hide it
    // (the preview card is wrapped in `max-md:hidden`).
    expect(getExportWindowWidth(200)).toBeGreaterThan(768);
  });
});
