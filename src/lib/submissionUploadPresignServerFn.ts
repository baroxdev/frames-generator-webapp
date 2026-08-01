import { createServerFn } from "@tanstack/react-start";
import { createServerSupabaseClient } from "./supabase-server-client";

export type PresignResult =
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; message: string };

const FALLBACK_MESSAGE = "Không thể tải ảnh lên. Vui lòng thử lại.";

/**
 * Server-only request for a presigned R2 upload URL for a visitor's tribute
 * image, via the `submission-presigned-upload` Supabase Edge Function.
 * Only this presign *request* moves server-side — the actual file body
 * still goes straight from the browser to R2 via the returned `uploadUrl`
 * (never proxied through our server), same constraint as the `/:slug`
 * SSR spec's presigned-upload rule.
 */
export const getSubmissionUploadPresignServerFn = createServerFn({
  method: "POST",
})
  .validator((params: { campaignId: string }) => params)
  .handler(async ({ data }): Promise<PresignResult> => {
    const client = createServerSupabaseClient();
    const { data: presign, error } = await client.functions.invoke<{
      uploadUrl: string;
      publicUrl: string;
    }>("submission-presigned-upload", {
      body: { campaignId: data.campaignId },
    });
    if (error || !presign) {
      return { ok: false, message: FALLBACK_MESSAGE };
    }
    return { ok: true, uploadUrl: presign.uploadUrl, publicUrl: presign.publicUrl };
  });
