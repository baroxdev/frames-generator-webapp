import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { trackPageView } from "../lib/analytics";

/**
 * Fires a GA4 `page_view` on every client-side navigation. TanStack
 * Router's `onResolved` runs after a route change has fully settled
 * (including the initial load), so this also covers the first page view —
 * there's no separate "first load" event to fire alongside it.
 */
export function usePageViewTracking() {
  const router = useRouter();

  useEffect(() => {
    return router.subscribe("onResolved", ({ toLocation }) => {
      trackPageView(toLocation.pathname);
    });
  }, [router]);
}
