// Talks to GA4 directly via gtag.js rather than through Firebase Analytics —
// the Firebase project this app also uses for storage has an expired
// billing account, and tying analytics to that project's health would take
// tracking down along with it. gtag.js only needs the GA4 property's
// Measurement ID, no Firebase project required.
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as
  | string
  | undefined;

let gtagPromise: Promise<Gtag> | null = null;

/**
 * Loads gtag.js and configures it exactly once, memoizing the in-flight
 * promise the same way `loadFacebookSdk` does — so a page-view fired on
 * mount and an event fired a moment later share one script load instead of
 * racing to inject the tag twice.
 *
 * `send_page_view: false` because this is an SPA: gtag.js's own automatic
 * page_view only fires once, on script load, and would never see
 * client-side route changes — those are reported explicitly by
 * `trackPageView` instead.
 */
function loadGtag(measurementId: string): Promise<Gtag> {
  if (gtagPromise) return gtagPromise;

  gtagPromise = new Promise((resolve) => {
    window.dataLayer = window.dataLayer ?? [];
    const gtag: Gtag = (...args) => {
      window.dataLayer!.push(args);
    };
    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", measurementId, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = () => resolve(gtag);
    document.head.appendChild(script);
  });

  return gtagPromise;
}

/**
 * Fire-and-forget wrapper: a missing Measurement ID, an ad blocker, or a
 * script load failure should never break the user-facing action this is
 * attached to, so every failure mode here just silently no-ops.
 */
function withGtag(send: (gtag: Gtag) => void) {
  if (typeof window === "undefined" || !MEASUREMENT_ID) return;

  try {
    loadGtag(MEASUREMENT_ID).then(send);
  } catch (error) {
    console.error("Failed to load analytics", error);
  }
}

export function trackPageView(path: string, title?: string) {
  trackEvent("page_view", {
    page_path: path,
    page_title: title,
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
  });
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  withGtag((gtag) => gtag("event", name, params));
}
