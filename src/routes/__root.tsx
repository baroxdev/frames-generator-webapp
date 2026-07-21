import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GoogleAnalytics } from "tanstack-router-ga4";
import { AuthSessionSync } from "../components/auth/AuthSessionSync";
import { usePageViewTracking } from "../hooks/usePageViewTracking";
import appCss from "../index.css?url";
import { NotFoundPage } from "../pages/public/NotFoundPage";

const SITE_TITLE = "Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025";
const SITE_DESCRIPTION =
  "Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025";

/**
 * Default, site-wide head tags — ported from the old index.html. Any route
 * that needs campaign-specific Open Graph data (the /:slug route) overrides
 * these via its own `head()`, since TanStack Router merges head entries from
 * root to leaf, with the leaf route's tags taking precedence.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        // <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1.0, maximum-scale=1.0",
        },
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        { name: "robots", content: "index, follow" },
        {
          name: "google-site-verification",
          content: "ViW66F_6uEM15INfe6GVCPL5xCu501iu-rxooatADL0",
        },
        { property: "og:title", content: SITE_TITLE },
        { property: "og:description", content: SITE_DESCRIPTION },
        { property: "og:image", content: "/welcome.png" },
        { property: "og:type", content: "website" },
        { property: "fb:app_id", content: "2183709991813992" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: SITE_TITLE },
        { name: "twitter:description", content: SITE_DESCRIPTION },
        { name: "twitter:image", content: "/welcome.png" },
      ],
      links: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
      ],
    }),
    component: RootComponent,
    notFoundComponent: NotFoundPage,
  },
);

const ga4Id = "G-2PXD8ERLX5";

function RootComponent() {
  usePageViewTracking();

  return (
    <RootDocument>
      <AuthSessionSync />
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        <GoogleAnalytics measurementId={ga4Id} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
