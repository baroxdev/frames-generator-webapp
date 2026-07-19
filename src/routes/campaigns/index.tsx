import { createFileRoute } from "@tanstack/react-router";
import { CampaignsPage } from "../../pages/campaigns/CampaignsPage";

export const Route = createFileRoute("/campaigns/")({
  ssr: false,
  component: CampaignsPage,
});
