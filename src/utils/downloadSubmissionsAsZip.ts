import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { Submission } from '../services/submission.service';

// JSZip holds every added file in memory until generateAsync() runs, so one
// zip covering thousands of already-compressed (~700KB, see
// storage.service.ts) tribute images could approach a gigabyte — a real
// risk of exhausting a browser tab's memory. Splitting into fixed-size
// parts bounds that per-zip memory footprint regardless of how large a
// campaign's submission count grows, at the cost of the owner getting
// "submissions-slug-phan-1.zip", "-phan-2.zip", etc. instead of one file.
// 500 keeps a typical 2,000-submission campaign to 4 parts rather than 7
// (at 300/part) — fewer parts means fewer automatic downloads in a row,
// which matters because of SAVE_GAP_MS below.
export const IMAGES_PER_ZIP_PART = 500;

// How many avatar images to fetch at once. High enough to keep the
// R2/CDN round-trips overlapped, low enough not to open hundreds of
// simultaneous connections when a campaign has 2,000+ submissions.
const FETCH_CONCURRENCY = 6;

// Chrome (and other browsers) silently blocks automatic downloads that fire
// in a tight loop with no user gesture in between, after the first couple —
// exactly what a multi-part zip would otherwise do. There's no real fix for
// this from client-side code alone (no user gesture exists between parts),
// so this only mitigates it: spacing saveAs() calls out reduces (doesn't
// eliminate) the chance of tripping that heuristic, and the caller is
// expected to warn the owner up front (see CampaignSubmissionsPage.tsx) to
// allow multiple downloads for this site if the browser prompts.
const SAVE_GAP_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DownloadProgress = {
  completed: number;
  total: number;
  failed: number;
  part: number;
  totalParts: number;
};

function sanitizeForFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'submission';
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Runs `worker` over `items` with at most `concurrency` in flight at once. */
async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= items.length) return;
    await worker(items[index]);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
}

async function buildZipPart(
  submissions: Submission[],
  onProgress: (completed: number, failed: number) => void,
): Promise<{ blob: Blob; failed: number }> {
  const zip = new JSZip();
  let completed = 0;
  let failed = 0;

  await runWithConcurrency(submissions, FETCH_CONCURRENCY, async (submission) => {
    try {
      const response = await fetch(submission.imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const fileName = `${sanitizeForFileName(submission.fullName)}-${submission.id.slice(0, 8)}.jpg`;
      zip.file(fileName, blob);
    } catch {
      failed += 1;
    } finally {
      completed += 1;
      onProgress(completed, failed);
    }
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, failed };
}

/**
 * Downloads every submission's tribute image for a campaign as one or more
 * zip files (ticket #7's "download all images" addendum), reporting
 * progress as it goes so the UI can show a progress bar instead of freezing
 * with no feedback for what can be a multi-minute operation on a large
 * campaign. A submission whose image fails to fetch (network error, R2
 * object already gone) is skipped and counted in the returned `failed`
 * total rather than aborting the whole download.
 */
export async function downloadSubmissionsAsZip(
  submissions: Submission[],
  campaignSlug: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<{ failed: number }> {
  const parts = chunk(submissions, IMAGES_PER_ZIP_PART);
  const total = submissions.length;
  let overallCompleted = 0;
  let overallFailed = 0;

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const partSubmissions = parts[partIndex];
    const baseCompleted = overallCompleted;
    const baseFailed = overallFailed;

    const { blob, failed } = await buildZipPart(partSubmissions, (completed, partFailed) => {
      onProgress?.({
        completed: baseCompleted + completed,
        total,
        failed: baseFailed + partFailed,
        part: partIndex + 1,
        totalParts: parts.length,
      });
    });

    overallCompleted = baseCompleted + partSubmissions.length;
    overallFailed = baseFailed + failed;

    const suffix = parts.length > 1 ? `-phan-${partIndex + 1}` : '';
    saveAs(blob, `submissions-${campaignSlug}${suffix}.zip`);

    if (partIndex < parts.length - 1) await wait(SAVE_GAP_MS);
  }

  onProgress?.({ completed: total, total, failed: overallFailed, part: parts.length, totalParts: parts.length });
  return { failed: overallFailed };
}
