// Minimal ambient shape of the pieces of the Facebook SDK for JavaScript
// this app actually calls — FB.init to register the app id, FB.ui to open
// the Share Dialog (developers.facebook.com/documentation/javascript). The
// real SDK is much larger; there's no need to type more of it than we use.
export interface FacebookSdk {
  init(options: { appId: string; xfbml: boolean; version: string }): void;
  ui(params: { method: 'share'; href: string }, callback: (response: unknown) => void): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';
// Matches Facebook's own Quickstart snippet
// (developers.facebook.com/documentation/javascript) at the time this was
// written — bump alongside Facebook's docs if the Share Dialog starts
// warning about a deprecated version.
const SDK_VERSION = 'v25.0';

let sdkPromise: Promise<FacebookSdk> | null = null;

/**
 * Loads and initializes the Facebook SDK for JavaScript exactly once,
 * memoizing the in-flight/resolved promise so every caller (the
 * CampaignsPage preload on mount, and any share click that happens to race
 * ahead of it) shares the same load rather than injecting the SDK script
 * tag twice or double-calling FB.init.
 *
 * Callers that want FB.ui() to open as a real popup rather than get
 * silently blocked should call this ahead of time (e.g. on mount) so that
 * by the time the owner actually clicks "share", `window.FB` is already
 * warm and the click handler can call `FB.ui()` synchronously — a browser
 * only treats a popup as originating from a trusted user gesture if it's
 * opened synchronously within the click handler, not after an intervening
 * `await` for a network-loaded script.
 */
export function loadFacebookSdk(appId: string): Promise<FacebookSdk> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = () => {
      const fb = window.FB;
      if (!fb) return;
      fb.init({ appId, xfbml: true, version: SDK_VERSION });
      resolve(fb);
    };

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = SDK_URL;
    document.body.appendChild(script);
  });

  return sdkPromise;
}
