import { createServerFn } from "@tanstack/react-start";
import {
  createSubmissionService,
  SubmissionServiceError,
  type SubmitTributeParams,
} from "../services/submission.service";
import { createServerSupabaseClient } from "./supabase-server-client";

export type SubmitTributeServerResult =
  | { ok: true; id: string }
  | { ok: false; message: string; code?: "CAMPAIGN_FULL" };

/**
 * Server-only tribute submission. The `submit-tribute` Supabase Edge
 * Function this calls already validates the Turnstile token and enforces
 * the campaign's submission cap server-side — this wrapper's job is only to
 * keep the browser from ever calling Supabase's URL/anon key directly for
 * this write, same rationale as the `/:slug` loader's server-side read.
 *
 * Errors are returned, not thrown: a thrown `SubmissionServiceError` loses
 * its subclass identity and `.code` across the server-function RPC
 * boundary, and `CampaignPublicPage` depends on `error.code ===
 * "CAMPAIGN_FULL"` to show the right UI — so the handler catches it here
 * and the client-side wrapper (`submission.queries.ts`) reconstructs the
 * real error from this plain result instead.
 */
export const submitTributeServerFn = createServerFn({ method: "POST" })
  .validator((params: SubmitTributeParams) => params)
  .handler(async ({ data }): Promise<SubmitTributeServerResult> => {
    try {
      const client = createServerSupabaseClient();
      const result = await createSubmissionService(client).submitTribute(data);
      return { ok: true, id: result.id };
    } catch (error) {
      if (error instanceof SubmissionServiceError) {
        return { ok: false, message: error.message, code: error.code };
      }
      return {
        ok: false,
        message: "Không thể gửi thông điệp. Vui lòng thử lại.",
      };
    }
  });
