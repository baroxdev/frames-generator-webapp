import type { SupabaseClient } from '@supabase/supabase-js';
import imageService from './image.service';

export interface StorageService {
  /**
   * Compresses (reusing the existing `image.service` compression, per the
   * ticket's requirement to reuse it as-is) and uploads a campaign
   * background image to Cloudflare R2, returning its public URL.
   */
  uploadCampaignBackground(file: File): Promise<string>;
  /**
   * Uploads a visitor's final composited tribute image to Cloudflare R2,
   * scoped to the given campaign, and returns its public URL. `image` is
   * always the JPEG blob produced by `frameCompositor.service.ts` — never
   * the visitor's raw avatar photo, which is never uploaded or stored
   * anywhere. No client-side compression here: the compositor's own JPEG
   * quality setting is the only compression this image gets (re-compressing
   * an already-lossy JPEG a second time loses quality for little size
   * benefit). Goes through the anonymous `submission-presigned-upload` Edge
   * Function — a visitor submitting a tribute never has a Supabase session.
   */
  uploadSubmissionImage(campaignId: string, image: Blob): Promise<string>;
}

/** Thrown by every storage.service method; `message` is always safe to show a user. */
export class StorageServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'StorageServiceError';
    this.cause = options?.cause;
  }
}

type PresignedUploadResponse = { uploadUrl: string; publicUrl: string };

const FALLBACK_MESSAGE = 'Không thể tải ảnh lên. Vui lòng thử lại.';

/**
 * PUTs `body` to R2 using a presigned URL obtained from the named Edge
 * Function, shared by both `uploadCampaignBackground` and
 * `uploadSubmissionImage` — they differ only in which function they call,
 * what extra fields that function's presign request needs, and whether the
 * upload needs compressing first (background: yes, client-picked photo;
 * submission image: no, already-compressed compositor output).
 */
async function uploadViaPresignedUrl(
  client: SupabaseClient,
  functionName: string,
  body: Blob,
  contentType: string,
  extraBody: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await client.functions.invoke<PresignedUploadResponse>(functionName, {
    body: extraBody,
  });
  if (error || !data) {
    throw new StorageServiceError(FALLBACK_MESSAGE, { cause: error });
  }

  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!uploadResponse.ok) {
    throw new StorageServiceError(FALLBACK_MESSAGE, {
      cause: new Error(`R2 upload failed with status ${uploadResponse.status}`),
    });
  }

  return data.publicUrl;
}

/**
 * Thin wrapper around Cloudflare R2 uploads, mirroring `auth.service.ts`'s
 * pattern: callers depend on this small interface, and the Supabase client
 * is injected so tests can mock it at the SDK boundary. The actual upload
 * goes straight from the browser to R2 using a presigned URL obtained from
 * an Edge Function (see supabase/functions/) — R2's access key/secret never
 * reach the client.
 */
export function createStorageService(client: SupabaseClient): StorageService {
  return {
    async uploadCampaignBackground(file) {
      const compressed = (await imageService.compressImage(file)) ?? file;
      return uploadViaPresignedUrl(client, 'r2-presigned-upload', compressed, compressed.type, {
        contentType: compressed.type,
      });
    },
    uploadSubmissionImage(campaignId, image) {
      return uploadViaPresignedUrl(client, 'submission-presigned-upload', image, 'image/jpeg', { campaignId });
    },
  };
}
