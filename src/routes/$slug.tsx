import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createCampaignService } from "../services/campaign.service";
import { createServerSupabaseClient } from "../lib/supabase-server-client";
import { CampaignPublicPage } from "../pages/public/CampaignPublicPage";
import { campaignHead } from "./-campaignHead";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";

const getCampaignBySlugServerFn = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    console.info("getCampaignBySlugServerFn", slug);
    const client = createServerSupabaseClient();
    return createCampaignService(client).getCampaignBySlug(slug);
  });

const campaignQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["campaign", "by-slug", slug],
    queryFn: () => getCampaignBySlugServerFn({ data: slug }),
  });

export const Route = createFileRoute("/$slug")({
  ssr: "data-only",
  loader: async ({ params: { slug }, context }) => {
    const data = await context.queryClient.ensureQueryData(
      campaignQueryOptions(slug),
    );
    console.log("Route loader", slug, data?.title);

    return data;
  },
  head: ({ loaderData }) => {
    console.log("Route head", loaderData);
    return loaderData
      ? campaignHead(loaderData)
      : {
          meta: [
            {
              title: "Chiến dịch không tồn tại",
              name: "description",
              content: "Chiến dịch không tồn tại",
            },
          ],
        };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  const campaign = useSuspenseQuery(campaignQueryOptions(slug));
  if (!campaign) {
    return null;
  }

  return (
    <Suspense>
      <ClientOnly>
        <CampaignPublicPage campaign={campaign.data} />
      </ClientOnly>
    </Suspense>
  );
}
