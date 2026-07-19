import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCuratedFont } from '../constants/fonts';
import type { CustomFont } from '../templates/types';
import { ensureFontReady, loadAllCuratedFonts, loadFont, loadGoogleFont } from './loadGoogleFont';

afterEach(() => {
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
  document.head.querySelectorAll('style[id^="custom-font-face-"]').forEach((style) => style.remove());
});

describe('loadGoogleFont', () => {
  it('appends a stylesheet link for the requested font', () => {
    loadGoogleFont('Montserrat');

    const href = getCuratedFont('Montserrat').googleFontsHref;
    expect(document.querySelector(`link[href="${href}"]`)).not.toBeNull();
  });

  it('does not append a duplicate link when called again for the same font', () => {
    loadGoogleFont('Lora');
    loadGoogleFont('Lora');

    const href = getCuratedFont('Lora').googleFontsHref;
    expect(document.querySelectorAll(`link[href="${href}"]`).length).toBe(1);
  });

  it('loads the house default font for an unrecognized family', () => {
    loadGoogleFont('Not A Real Font');

    const defaultHref = getCuratedFont(undefined).googleFontsHref;
    expect(document.querySelector(`link[href="${defaultHref}"]`)).not.toBeNull();
  });
});

describe('loadFont', () => {
  // Each test below uses its own distinct family — `injectCustomFontFace`
  // caches which custom fonts it already injected at module scope (mirroring
  // ensureFontReady's own per-combo cache below), so reusing one family
  // across tests would let a later test see that cache already primed by an
  // earlier test instead of exercising its own injection.
  function fixtureCustomFont(family: string): CustomFont {
    return {
      family,
      url: `https://cdn.example.com/campaign-fonts/owner/${family}.woff2`,
      format: 'woff2',
      originalFileName: `${family}.woff2`,
    };
  }

  it('injects an inline @font-face style tag for a custom font instead of a Google Fonts link', () => {
    const customFont = fixtureCustomFont('custom-brand-font-inject');
    loadFont(customFont.family, customFont);

    const style = document.getElementById(`custom-font-face-${customFont.family}`);
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain(`font-family: '${customFont.family}'`);
    expect(style?.textContent).toContain(`src: url('${customFont.url}') format('woff2')`);
    // A range, not a single weight — see injectCustomFontFace's doc comment
    // for why (avoids synthesized/fake bold at a weight the file doesn't declare).
    expect(style?.textContent).toContain('font-weight: 100 900');
  });

  it('does not duplicate the style tag when called again for the same custom font', () => {
    const customFont = fixtureCustomFont('custom-brand-font-dedupe');
    loadFont(customFont.family, customFont);
    loadFont(customFont.family, customFont);

    expect(document.querySelectorAll(`#custom-font-face-${customFont.family}`).length).toBe(1);
  });

  it('falls back to loadGoogleFont when no custom font is given', () => {
    loadFont('Lobster');

    const href = getCuratedFont('Lobster').googleFontsHref;
    expect(document.querySelector(`link[href="${href}"]`)).not.toBeNull();
  });
});

describe('loadAllCuratedFonts', () => {
  it('appends a stylesheet link for every given font', () => {
    const fonts = [getCuratedFont('Roboto'), getCuratedFont('Pacifico')];
    loadAllCuratedFonts(fonts);

    for (const font of fonts) {
      expect(document.querySelector(`link[href="${font.googleFontsHref}"]`)).not.toBeNull();
    }
  });
});

// jsdom has no real network stack, so a `<link>`'s `load` event never fires
// on its own the way it would in a real browser — tests that need
// `loadStylesheet`'s promise to settle must dispatch it manually. The
// `Promise` executor inside `loadStylesheet` runs synchronously, so the
// `<link>` is already in the DOM by the time `ensureFontReady(...)` returns
// its (still-pending) promise, letting a test grab it before awaiting.
function resolveStylesheetLoad(family: string): void {
  const href = getCuratedFont(family).googleFontsHref;
  document.querySelector(`link[href="${href}"]`)?.dispatchEvent(new Event('load'));
}

// Each test below uses a distinct family/weight combo — `ensureFontReady`
// caches its readiness promise per combo at module scope, so reusing one
// across tests would make a later test see a stale cached (already-settled)
// promise instead of exercising its own mocked document.fonts.load call.
describe('ensureFontReady', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'fonts');
  });

  it('resolves without throwing when the CSS Font Loading API is unavailable (e.g. this test environment)', async () => {
    await expect(ensureFontReady('Nunito', 700)).resolves.toBeUndefined();
  });

  it('loads the stylesheet and calls document.fonts.load with the requested weight when the Font Loading API is available', async () => {
    const loadSpy = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', { value: { load: loadSpy }, configurable: true });

    const promise = ensureFontReady('Open Sans', 700);
    resolveStylesheetLoad('Open Sans');
    await promise;

    const href = getCuratedFont('Open Sans').googleFontsHref;
    expect(document.querySelector(`link[href="${href}"]`)).not.toBeNull();
    expect(loadSpy).toHaveBeenCalledWith('700 16px "Open Sans"');
  });

  it('caches readiness per family+weight so a repeat call does not re-invoke document.fonts.load', async () => {
    const loadSpy = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', { value: { load: loadSpy }, configurable: true });

    const first = ensureFontReady('Merriweather', 400);
    resolveStylesheetLoad('Merriweather');
    await first;
    await ensureFontReady('Merriweather', 400);

    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves even when document.fonts.load rejects, instead of hanging the caller forever', async () => {
    const loadSpy = vi.fn().mockRejectedValue(new Error('network error'));
    Object.defineProperty(document, 'fonts', { value: { load: loadSpy }, configurable: true });

    const promise = ensureFontReady('Baloo 2', 700);
    resolveStylesheetLoad('Baloo 2');

    await expect(promise).resolves.toBeUndefined();
  });

  it('injects the custom font and calls document.fonts.load with its own family when a CustomFont is given, instead of consulting the curated list', async () => {
    const loadSpy = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', { value: { load: loadSpy }, configurable: true });
    const customFont = {
      family: 'custom-ensure-ready-xyz',
      url: 'https://cdn.example.com/campaign-fonts/owner/font.woff2',
      format: 'woff2' as const,
      originalFileName: 'font.woff2',
    };

    await ensureFontReady('custom-ensure-ready-xyz', 700, customFont);

    expect(document.getElementById(`custom-font-face-${customFont.family}`)).not.toBeNull();
    expect(loadSpy).toHaveBeenCalledWith('700 16px "custom-ensure-ready-xyz"');
  });
});
