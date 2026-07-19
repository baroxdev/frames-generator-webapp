import { createFileRoute } from "@tanstack/react-router";
import { EditCampaignLayoutPage } from "../../pages/campaigns/EditCampaignLayoutPage";

export const Route = createFileRoute("/campaigns/$id/edit")({
  ssr: false,
  component: EditCampaignLayoutPage,
});
