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
   * Compresses and uploads a visitor's tribute avatar to Cloudflare R2,
   * scoped to the given campaign. Unlike `uploadCampaignBackground`, this
   * goes through the anonymous `submission-presigned-upload` Edge
   * Function — a visitor submitting a tribute never has a Supabase session.
   */
  uploadSubmissionAvatar(campaignId: string, file: File): Promise<string>;
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
 * Compresses `file` and PUTs it to R2 using a presigned URL obtained from
 * the named Edge Function, shared by both `uploadCampaignBackground` and
 * `uploadSubmissionAvatar` — they differ only in which function they call
 * and what extra fields that function's presign request needs.
 */
async function uploadViaPresignedUrl(
  client: SupabaseClient,
  functionName: string,
  file: File,
  extraBody: Record<string, unknown>,
): Promise<string> {
  const compressed = (await imageService.compressImage(file)) ?? file;

  const { data, error } = await client.functions.invoke<PresignedUploadResponse>(functionName, {
    body: { contentType: compressed.type, ...extraBody },
  });
  if (error || !data) {
    throw new StorageServiceError(FALLBACK_MESSAGE, { cause: error });
  }

  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.type },
    body: compressed,
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
    uploadCampaignBackground(file) {
      return uploadViaPresignedUrl(client, 'r2-presigned-upload', file, {});
    },
    uploadSubmissionAvatar(campaignId, file) {
      return uploadViaPresignedUrl(client, 'submission-presigned-upload', file, { campaignId });
    },
  };
}
