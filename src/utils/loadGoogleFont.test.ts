import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCuratedFont } from '../constants/fonts';
import { ensureFontReady, loadAllCuratedFonts, loadGoogleFont } from './loadGoogleFont';

afterEach(() => {
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
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
});
