import { createFileRoute } from "@tanstack/react-router";
import { NewCampaignPage } from "../../pages/campaigns/NewCampaignPage";

export const Route = createFileRoute("/campaigns/new")({
  ssr: false,
  component: NewCampaignPage,
});
