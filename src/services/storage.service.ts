import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CUSTOM_FONT_CONTENT_TYPE,
  customFontFormatForFileName,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
} from '../utils/customFont';
import type { CustomFontFormat } from '../templates/types';
import imageService from './image.service';

export interface UploadedCustomFont {
  url: string;
  format: CustomFontFormat;
}

export interface StorageService {
  uploadCampaignBackground(file: File): Promise<string>;
  /**
   * Uploads a campaign's public-page header banner. Any aspect ratio is
   * accepted (no crop step) — only the same size/format compression as
   * `uploadCampaignBackground` applies. Stored under its own
   * `campaign-headers/` R2 prefix, see r2-presigned-upload's `folder` param.
   */
  uploadCampaignHeader(file: File): Promise<string>;
  /**
   * Uploads a campaign owner's own font file (.woff2/.ttf/.otf) to its own
   * `campaign-fonts/` R2 prefix — no compression step (unlike images), the
   * file is uploaded as-is. Rejects client-side for an unsupported extension
   * or a file over `MAX_CUSTOM_FONT_FILE_SIZE_BYTES` before ever calling the
   * presign function.
   */
  uploadCampaignFont(file: File): Promise<UploadedCustomFont>;
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
const FONT_FALLBACK_MESSAGE = 'Không thể tải phông chữ lên. Vui lòng thử lại.';

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
    async uploadCampaignFont(file) {
      const format = customFontFormatForFileName(file.name);
      if (!format) {
        throw new StorageServiceError('Chỉ chấp nhận phông chữ định dạng WOFF2, TTF hoặc OTF.');
      }
      if (file.size > MAX_CUSTOM_FONT_FILE_SIZE_BYTES) {
        throw new StorageServiceError(
          `Tệp phông chữ tối đa ${Math.floor(MAX_CUSTOM_FONT_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
        );
      }
      const contentType = CUSTOM_FONT_CONTENT_TYPE[format];
      const url = await uploadViaPresignedUrl(client, 'r2-presigned-upload', file, contentType, {
        contentType,
        folder: 'campaign-fonts',
      }).catch((error) => {
        throw new StorageServiceError(FONT_FALLBACK_MESSAGE, { cause: error });
      });
      return { url, format };
    },
  };
}
