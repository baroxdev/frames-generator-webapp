import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthSessionSync } from "../components/auth/AuthSessionSync";
import { usePageViewTracking } from "../hooks/usePageViewTracking";
import { NotFoundPage } from "../pages/public/NotFoundPage";
import appCss from "../index.css?url";

// Single QueryClient for the whole app, same as the previous main.tsx setup —
// every route's queries/mutations reuse this instance via QueryClientProvider
// rather than creating their own.
const queryClient = new QueryClient();

const SITE_TITLE = "Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025";
const SITE_DESCRIPTION =
  "Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025";

/**
 * Default, site-wide head tags — ported from the old index.html. Any route
 * that needs campaign-specific Open Graph data (the /:slug route) overrides
 * these via its own `head()`, since TanStack Router merges head entries from
 * root to leaf, with the leaf route's tags taking precedence.
 */
export const Route = createRootRoute({
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
      { rel: "icon", type: "image/svg+xml", href: "/favicon.ico" },
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
});

function RootComponent() {
  usePageViewTracking();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <AuthSessionSync />
        <Outlet />
      </QueryClientProvider>
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
        {children}
        <Scripts />
      </body>
    </html>
  );
}
