import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { mockCompressImage } = vi.hoisted(() => ({ mockCompressImage: vi.fn() }));

vi.mock('./image.service', () => ({
  default: { compressImage: mockCompressImage },
}));

import { StorageServiceError, createStorageService } from './storage.service';

function createMockSupabaseClient(overrides: { invoke?: ReturnType<typeof vi.fn> } = {}) {
  return {
    functions: {
      invoke: overrides.invoke ?? vi.fn(),
    },
  } as unknown as SupabaseClient;
}

const ORIGINAL_FILE = new File(['original'], 'background.jpg', { type: 'image/jpeg' });
const COMPRESSED_FILE = new File(['compressed'], 'background.jpg', { type: 'image/jpeg' });
const PRESIGNED = {
  uploadUrl: 'https://r2.example.com/campaign-backgrounds/user-1/abc.jpg?X-Amz-Signature=...',
  publicUrl: 'https://cdn.example.com/campaign-backgrounds/user-1/abc.jpg',
};

describe('storage.service', () => {
  beforeEach(() => {
    mockCompressImage.mockReset();
    mockCompressImage.mockResolvedValue(COMPRESSED_FILE);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compresses the file, requests a presigned URL, PUTs the compressed file to R2, and returns the public URL', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: PRESIGNED, error: null });
    const client = createMockSupabaseClient({ invoke });
    const service = createStorageService(client);

    const result = await service.uploadCampaignBackground(ORIGINAL_FILE);

    expect(mockCompressImage).toHaveBeenCalledWith(ORIGINAL_FILE);
    expect(invoke).toHaveBeenCalledWith('r2-presigned-upload', { body: { contentType: 'image/jpeg' } });
    expect(fetch).toHaveBeenCalledWith(
      PRESIGNED.uploadUrl,
      expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: COMPRESSED_FILE }),
    );
    expect(result).toBe(PRESIGNED.publicUrl);
  });

  it('falls back to the original file when compression fails', async () => {
    mockCompressImage.mockResolvedValue(null);
    const invoke = vi.fn().mockResolvedValue({ data: PRESIGNED, error: null });
    const client = createMockSupabaseClient({ invoke });
    const service = createStorageService(client);

    await service.uploadCampaignBackground(ORIGINAL_FILE);

    expect(fetch).toHaveBeenCalledWith(PRESIGNED.uploadUrl, expect.objectContaining({ body: ORIGINAL_FILE }));
  });

  it('throws a StorageServiceError when requesting the presigned URL fails', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'unauthorized' } });
    const client = createMockSupabaseClient({ invoke });
    const service = createStorageService(client);

    await expect(service.uploadCampaignBackground(ORIGINAL_FILE)).rejects.toBeInstanceOf(StorageServiceError);
  });

  it('throws a StorageServiceError when the R2 PUT fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const invoke = vi.fn().mockResolvedValue({ data: PRESIGNED, error: null });
    const client = createMockSupabaseClient({ invoke });
    const service = createStorageService(client);

    await expect(service.uploadCampaignBackground(ORIGINAL_FILE)).rejects.toBeInstanceOf(StorageServiceError);
  });

  describe('uploadSubmissionImage', () => {
    const COMPOSITED_IMAGE = new Blob(['composited'], { type: 'image/jpeg' });
    const SUBMISSION_PRESIGNED = {
      uploadUrl: 'https://r2.example.com/submissions/campaign-1/abc.jpg?X-Amz-Signature=...',
      publicUrl: 'https://cdn.example.com/submissions/campaign-1/abc.jpg',
    };

    it('compresses the composited image (targeting <700KB, see image.service.ts), PUTs the result to R2, and returns the public URL', async () => {
      const compressedSubmissionImage = new File(['compressed-tribute'], 'tribute.jpg', { type: 'image/jpeg' });
      mockCompressImage.mockResolvedValue(compressedSubmissionImage);
      const invoke = vi.fn().mockResolvedValue({ data: SUBMISSION_PRESIGNED, error: null });
      const client = createMockSupabaseClient({ invoke });
      const service = createStorageService(client);

      const result = await service.uploadSubmissionImage('campaign-1', COMPOSITED_IMAGE);

      expect(mockCompressImage).toHaveBeenCalledWith(expect.any(File));
      expect(invoke).toHaveBeenCalledWith('submission-presigned-upload', {
        body: { campaignId: 'campaign-1' },
      });
      expect(fetch).toHaveBeenCalledWith(
        SUBMISSION_PRESIGNED.uploadUrl,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: compressedSubmissionImage,
        }),
      );
      expect(result).toBe(SUBMISSION_PRESIGNED.publicUrl);
    });

    it('falls back to the uncompressed composited image when compression fails', async () => {
      mockCompressImage.mockResolvedValue(null);
      const invoke = vi.fn().mockResolvedValue({ data: SUBMISSION_PRESIGNED, error: null });
      const client = createMockSupabaseClient({ invoke });
      const service = createStorageService(client);

      await service.uploadSubmissionImage('campaign-1', COMPOSITED_IMAGE);

      expect(fetch).toHaveBeenCalledWith(
        SUBMISSION_PRESIGNED.uploadUrl,
        expect.objectContaining({ body: COMPOSITED_IMAGE }),
      );
    });

    it('throws a StorageServiceError when requesting the presigned URL fails', async () => {
      const invoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'campaign not approved' } });
      const client = createMockSupabaseClient({ invoke });
      const service = createStorageService(client);

      await expect(service.uploadSubmissionImage('campaign-1', COMPOSITED_IMAGE)).rejects.toBeInstanceOf(
        StorageServiceError,
      );
    });
  });
});
