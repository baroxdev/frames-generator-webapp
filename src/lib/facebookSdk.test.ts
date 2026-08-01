import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `loadFacebookSdk` memoizes its promise at module scope, so each test
// needs a fresh module instance to avoid bleeding state between cases.
async function importFresh() {
  vi.resetModules();
  return import('./facebookSdk');
}

describe('loadFacebookSdk', () => {
  beforeEach(() => {
    delete (window as { FB?: unknown }).FB;
    delete (window as { fbAsyncInit?: unknown }).fbAsyncInit;
    document.querySelectorAll('script').forEach((script) => script.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects the SDK script tag and resolves once fbAsyncInit fires, initializing with the given app id', async () => {
    const { loadFacebookSdk } = await importFresh();

    const promise = loadFacebookSdk('app-id-123');
    const script = document.querySelector('script[src="https://connect.facebook.net/en_US/sdk.js"]');
    expect(script).toBeTruthy();

    const initSpy = vi.fn();
    window.FB = { init: initSpy, ui: vi.fn() };
    window.fbAsyncInit?.();

    const sdk = await promise;
    expect(initSpy).toHaveBeenCalledWith({ appId: 'app-id-123', xfbml: true, version: 'v25.0' });
    expect(sdk).toBe(window.FB);
  });

  it('resolves immediately without injecting a script if window.FB is already present', async () => {
    const { loadFacebookSdk } = await importFresh();
    const existingFB = { init: vi.fn(), ui: vi.fn() };
    window.FB = existingFB;

    const sdk = await loadFacebookSdk('app-id-123');

    expect(sdk).toBe(existingFB);
    expect(document.querySelector('script[src="https://connect.facebook.net/en_US/sdk.js"]')).toBeNull();
  });

  it('memoizes the load so a second call does not inject another script tag', async () => {
    const { loadFacebookSdk } = await importFresh();

    const first = loadFacebookSdk('app-id-123');
    const second = loadFacebookSdk('app-id-123');

    window.FB = { init: vi.fn(), ui: vi.fn() };
    window.fbAsyncInit?.();
    await Promise.all([first, second]);

    expect(document.querySelectorAll('script[src="https://connect.facebook.net/en_US/sdk.js"]')).toHaveLength(1);
    expect(first).toBe(second);
  });
});
