import type { SupabaseClient } from '@supabase/supabase-js';
import imageService from './image.service';

export interface StorageService {
  uploadCampaignBackground(file: File): Promise<string>;
  /**
   * Uploads a campaign's public-page header banner. Any aspect ratio is
   * accepted (no crop step) — only the same size/format compression as
   * `uploadCampaignBackground` applies. Stored under its own
   * `campaign-headers/` R2 prefix, see r2-presigned-upload's `folder` param.
   */
  uploadCampaignHeader(file: File): Promise<string>;
}

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


export function createStorageService(client: SupabaseClient): StorageService {
  return {
    async uploadCampaignBackground(file) {
      const compressed = (await imageService.compressImage(file)) ?? file;
      return uploadViaPresignedUrl(client, 'r2-presigned-upload', compressed, compressed.type, {
        contentType: compressed.type,
      });
    },
    async uploadCampaignHeader(file) {
      const compressed = (await imageService.compressImage(file)) ?? file;
      return uploadViaPresignedUrl(client, 'r2-presigned-upload', compressed, compressed.type, {
        contentType: compressed.type,
        folder: 'campaign-headers',
      });
    },
  };
}
