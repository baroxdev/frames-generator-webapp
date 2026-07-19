import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthSessionSync } from "../components/auth/AuthSessionSync";
import { NotFoundPage } from "../pages/public/NotFoundPage";
import appCss from "../index.css?url";

// Single QueryClient for the whole app, same as the previous main.tsx setup —
// every route's queries/mutations reuse this instance via QueryClientProvider
// rather than creating their own.
const queryClient = new QueryClient();

const SITE_TITLE = "Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025";
const SITE_DESCRIPTION = "Đại hội Cháu ngoan Bác Hồ tỉnh Bến Tre lần thứ XIII 2025";

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
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { name: "google-site-verification", content: "ViW66F_6uEM15INfe6GVCPL5xCu501iu-rxooatADL0" },
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
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playwrite+HU:wght@100;200;300;400&display=swap",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
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
        {/* Ensures the custom font is available before html2canvas/modern-screenshot
            rasterize the frame — see index.html's original comment. */}
        <style>{`
          @font-face {
            font-family: 'Playwrite HU';
            font-display: swap;
            font-weight: 100 400;
            src: url(https://fonts.gstatic.com/s/playwritehu/v10/playwrighthufont.woff2) format('woff2');
            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
          }
        `}</style>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
