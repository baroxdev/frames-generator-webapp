import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createCampaignService } from "../services/campaign.service";
import { createServerSupabaseClient } from "../lib/supabase-server-client";
import { CampaignPublicPage } from "../pages/public/CampaignPublicPage";
import { campaignHead } from "./-campaignHead";

/**
 * Server-only campaign-by-slug lookup for the public `/:slug` page. Reuses
 * the anon-key Supabase client (same RLS-gated visibility as a browser call
 * — see `campaign.service.ts`'s `getCampaignBySlug` doc comment on why a
 * pending/rejected/suspended campaign and a never-registered slug both
 * resolve to `null` here, indistinguishably) — just called server-side so
 * the initial page load never ships a client-side Supabase round-trip for
 * this route, and so the resolved SEO data is available to `head()` for the
 * server-rendered response.
 */
const getCampaignBySlugServerFn = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const client = createServerSupabaseClient();
    return createCampaignService(client).getCampaignBySlug(slug);
  });

export const Route = createFileRoute("/$slug")({
  // "data-only": the loader (and therefore `head()`, which needs its data)
  // runs server-side, so the SSR response carries real Open Graph tags —
  // but the component itself is NOT rendered server-side. CampaignPublicPage
  // pulls in Konva/canvas-only code (PrintArea, the compositor) that isn't
  // safe to execute outside a browser; this keeps that entire dependency
  // graph out of the server bundle while still hitting this route's actual
  // goal (real meta tags in the initial HTML).
  ssr: "data-only",
  loader: ({ params }) => getCampaignBySlugServerFn({ data: params.slug }),
  head: ({ loaderData }) => campaignHead(loaderData ?? null),
  component: RouteComponent,
});

function RouteComponent() {
  const campaign = Route.useLoaderData();
  return <CampaignPublicPage campaign={campaign} />;
}
