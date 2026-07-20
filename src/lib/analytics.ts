// Talks to GA4 directly via gtag.js rather than through Firebase Analytics —
// the Firebase project this app also uses for storage has an expired
// billing account, and tying analytics to that project's health would take
// tracking down along with it. gtag.js only needs the GA4 property's
// Measurement ID, no Firebase project required.
//
// PostHog runs alongside GA4 as a backup: every `trackEvent`/`trackPageView`
// call fans out to both providers independently, so an outage or ad-blocker
// hit on one (e.g. GA4 is commonly blocked) still leaves the other with a
// full record of the same events.
import posthog from "posthog-js";

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

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  "https://us.i.posthog.com";

let gtagPromise: Promise<Gtag> | null = null;
let posthogInitialized = false;

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

/**
 * Initializes posthog-js exactly once. `capture_pageview`/`capture_pageleave`
 * are disabled because page views are already reported explicitly by
 * `trackPageView`, the same "no automatic page_view" split used for gtag.
 */
function loadPosthog(key: string) {
  if (posthogInitialized) return;
  posthogInitialized = true;

  posthog.init(key, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: false,
  });
}

/**
 * Fire-and-forget wrapper mirroring `withGtag`: a missing project key, an ad
 * blocker, or an init failure should never break the user-facing action this
 * is attached to.
 */
function withPosthog(send: (client: typeof posthog) => void) {
  if (typeof window === "undefined" || !POSTHOG_KEY) return;

  try {
    loadPosthog(POSTHOG_KEY);
    send(posthog);
  } catch (error) {
    console.error("Failed to send PostHog event", error);
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
  withPosthog((client) => client.capture(name, params));
}

/**
 * Ties subsequent events to a logged-in owner, so owner-level rollups (e.g.
 * "submissions across all of this owner's campaigns this month", for
 * scalability/paywall analysis) work in both tools instead of only landing
 * as anonymous, per-session events. Call on sign-in; pair with `resetUser`
 * on sign-out.
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean | undefined>,
) {
  withGtag((gtag) => gtag("set", { user_id: userId }));
  withPosthog((client) => client.identify(userId, properties));
}

/** Clears the identity set by `identifyUser`. Call on sign-out. */
export function resetUser() {
  withGtag((gtag) => gtag("set", { user_id: undefined }));
  withPosthog((client) => client.reset());
}
