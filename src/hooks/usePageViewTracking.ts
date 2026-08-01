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
      // Only the public campaign route (`/$slug`) has a campaign to attach
      // — matching on the resolved route id rather than parsing the path
      // avoids misreading other single-segment routes (/login, /account,
      // /signup, ...) as campaign slugs.
      const slugMatch = router.state.matches.find(
        (match) => match.routeId === "/$slug",
      );
      const campaignSlug = (slugMatch?.params as { slug?: string } | undefined)
        ?.slug;

      trackPageView(toLocation.pathname, undefined, { campaignSlug });
    });
  }, [router]);
}
