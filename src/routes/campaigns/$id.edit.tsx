import { createFileRoute } from "@tanstack/react-router";
import { EditCampaignPage } from "../../pages/campaigns/EditCampaignPage";

export const Route = createFileRoute("/campaigns/$id/edit")({
  ssr: false,
  component: EditCampaignPage,
});
