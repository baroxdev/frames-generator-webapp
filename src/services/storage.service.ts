import type { SupabaseClient } from '@supabase/supabase-js';
import imageService from './image.service';

export interface StorageService {
  uploadCampaignBackground(file: File): Promise<string>;
  uploadSubmissionImage(campaignId: string, image: Blob): Promise<string>;
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
    async uploadSubmissionImage(campaignId, image) {
      const asFile = new File([image], 'tribute.jpg', { type: 'image/jpeg' });
      const compressed = (await imageService.compressImage(asFile)) ?? image;
      return uploadViaPresignedUrl(client, 'submission-presigned-upload', compressed, 'image/jpeg', { campaignId });
    },
  };
}
