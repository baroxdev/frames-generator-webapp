import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authKeys } from "../queries/auth.queries";
import { NewCampaignPage } from "../pages/campaigns/NewCampaignPage";

// Local-only visual QA harness: stubs a fake session directly in the query
// cache instead of logging in, so the responsive layout can be eyeballed in
// a real browser without touching Supabase auth. Not wired into any nav,
// deleted once the visual check is done.
function DevNewCampaignPreview() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queryClient.setQueryData(authKeys.session(), {
      access_token: "dev",
      token_type: "bearer",
      user: { id: "dev-user", email: "dev@example.com" },
    });
    setReady(true);
  }, [queryClient]);

  if (!ready) return null;
  return <NewCampaignPage />;
}

export const Route = createFileRoute("/dev-new-campaign-preview")({
  component: DevNewCampaignPreview,
});
