// Fetches one image and triggers a real "Save As" (not just "open in a new
// tab") even though the image lives on a cross-origin R2 domain: a plain
// `<a href={crossOriginUrl} download>` is silently ignored by browsers for
// cross-origin targets, so the bytes have to be pulled into the page first
// and re-offered as a same-origin `blob:` URL, which `download` does
// respect.
//
// This is safe to do per-click (unlike a bulk "download everything" loop)
// because it's a single, user-gestured fetch — R2's public `*.r2.dev`
// domain is only rate-limited under bursts of concurrent requests (see
// git history / the removed downloadSubmissionsAsZip.ts for what that
// looked like), not occasional one-off reads.
export async function downloadImage(url: string, fileName: string): Promise<void> {
  const response = await fetch(url, { method: 'GET', mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Không thể tải ảnh (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
