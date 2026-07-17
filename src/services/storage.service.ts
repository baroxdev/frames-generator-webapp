import type { SupabaseClient } from '@supabase/supabase-js';
import imageService from './image.service';

export interface StorageService {
  /**
   * Compresses (reusing the existing `image.service` compression, per the
   * ticket's requirement to reuse it as-is) and uploads a campaign
   * background image to Cloudflare R2, returning its public URL.
   */
  uploadCampaignBackground(file: File): Promise<string>;
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
 * Thin wrapper around Cloudflare R2 uploads, mirroring `auth.service.ts`'s
 * pattern: callers depend on this small interface, and the Supabase client
 * is injected so tests can mock it at the SDK boundary. The actual upload
 * goes straight from the browser to R2 using a presigned URL obtained from
 * the `r2-presigned-upload` Edge Function (see
 * supabase/functions/r2-presigned-upload) — R2's access key/secret never
 * reach the client.
 */
export function createStorageService(client: SupabaseClient): StorageService {
  return {
    async uploadCampaignBackground(file) {
      const compressed = (await imageService.compressImage(file)) ?? file;

      const { data, error } = await client.functions.invoke<PresignedUploadResponse>('r2-presigned-upload', {
        body: { contentType: compressed.type },
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
    },
  };
}
