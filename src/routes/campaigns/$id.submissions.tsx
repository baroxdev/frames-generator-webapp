import { createFileRoute } from "@tanstack/react-router";
import { CampaignSubmissionsPage } from "../../pages/campaigns/CampaignSubmissionsPage";

export const Route = createFileRoute("/campaigns/$id/submissions")({
  ssr: false,
  component: CampaignSubmissionsPage,
});
