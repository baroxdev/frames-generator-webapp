import imageService from "../services/image.service";
import { StorageServiceError } from "../services/storage.service";
import { getSubmissionUploadPresignServerFn } from "./submissionUploadPresignServerFn";

const R2_PUT_FAILED_MESSAGE = "Không thể tải ảnh lên. Vui lòng thử lại.";

/**
 * Uploads a visitor's composited tribute image: compresses client-side
 * (needs the browser's Image/Canvas APIs, so this step can't move
 * server-side), fetches a presigned R2 URL via
 * `getSubmissionUploadPresignServerFn` (server-side, hides the Supabase
 * call from the browser), then PUTs the compressed bytes straight to R2.
 */
export async function uploadSubmissionImage(campaignId: string, image: Blob): Promise<string> {
  const asFile = new File([image], "tribute.jpg", { type: "image/jpeg" });
  const compressed = (await imageService.compressImage(asFile)) ?? image;

  const presign = await getSubmissionUploadPresignServerFn({ data: { campaignId } });
  if (!presign.ok) {
    throw new StorageServiceError(presign.message);
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: compressed,
  });
  if (!uploadResponse.ok) {
    throw new StorageServiceError(R2_PUT_FAILED_MESSAGE, {
      cause: new Error(`R2 upload failed with status ${uploadResponse.status}`),
    });
  }

  return presign.publicUrl;
}
