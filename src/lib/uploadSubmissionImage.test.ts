import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageServiceError } from "../services/storage.service";

const { mockCompressImage, mockGetPresign } = vi.hoisted(() => ({
  mockCompressImage: vi.fn(),
  mockGetPresign: vi.fn(),
}));

vi.mock("../services/image.service", () => ({
  default: { compressImage: mockCompressImage },
}));

vi.mock("./submissionUploadPresignServerFn", () => ({
  getSubmissionUploadPresignServerFn: mockGetPresign,
}));

import { uploadSubmissionImage } from "./uploadSubmissionImage";

const COMPOSITED_IMAGE = new Blob(["composited"], { type: "image/jpeg" });
const PRESIGNED = {
  uploadUrl: "https://r2.example.com/submissions/campaign-1/abc.jpg?X-Amz-Signature=...",
  publicUrl: "https://cdn.example.com/submissions/campaign-1/abc.jpg",
};

describe("uploadSubmissionImage", () => {
  beforeEach(() => {
    mockCompressImage.mockReset();
    mockGetPresign.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("compresses the image, requests a presign via the server function (never Supabase directly), PUTs straight to R2, and returns the public URL", async () => {
    const compressed = new File(["compressed-tribute"], "tribute.jpg", { type: "image/jpeg" });
    mockCompressImage.mockResolvedValue(compressed);
    mockGetPresign.mockResolvedValue({ ok: true, ...PRESIGNED });

    const result = await uploadSubmissionImage("campaign-1", COMPOSITED_IMAGE);

    expect(mockCompressImage).toHaveBeenCalledWith(expect.any(File));
    expect(mockGetPresign).toHaveBeenCalledWith({ data: { campaignId: "campaign-1" } });
    expect(fetch).toHaveBeenCalledWith(
      PRESIGNED.uploadUrl,
      expect.objectContaining({ method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: compressed }),
    );
    expect(result).toBe(PRESIGNED.publicUrl);
  });

  it("falls back to the uncompressed image when compression fails", async () => {
    mockCompressImage.mockResolvedValue(null);
    mockGetPresign.mockResolvedValue({ ok: true, ...PRESIGNED });

    await uploadSubmissionImage("campaign-1", COMPOSITED_IMAGE);

    expect(fetch).toHaveBeenCalledWith(PRESIGNED.uploadUrl, expect.objectContaining({ body: COMPOSITED_IMAGE }));
  });

  it("throws a StorageServiceError when the presign request fails", async () => {
    mockCompressImage.mockResolvedValue(null);
    mockGetPresign.mockResolvedValue({ ok: false, message: "campaign not approved" });

    await expect(uploadSubmissionImage("campaign-1", COMPOSITED_IMAGE)).rejects.toBeInstanceOf(StorageServiceError);
  });

  it("throws a StorageServiceError when the R2 PUT fails", async () => {
    mockCompressImage.mockResolvedValue(null);
    mockGetPresign.mockResolvedValue({ ok: true, ...PRESIGNED });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(uploadSubmissionImage("campaign-1", COMPOSITED_IMAGE)).rejects.toBeInstanceOf(StorageServiceError);
  });
});
