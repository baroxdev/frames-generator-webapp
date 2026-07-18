import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Submission } from '../services/submission.service';

const saveAs = vi.fn();
vi.mock('file-saver', () => ({ saveAs: (...args: unknown[]) => saveAs(...args) }));

const generateAsync = vi.fn().mockResolvedValue(new Blob(['zip']));
const zipFile = vi.fn();
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: zipFile,
    generateAsync,
  })),
}));

import { downloadSubmissionsAsZip } from './downloadSubmissionsAsZip';

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 'submission-1',
    campaignId: 'campaign-1',
    fullName: 'Nguyễn Văn A',
    role: 'Cựu học sinh',
    message: 'Chúc mừng đại hội!',
    imageUrl: 'https://cdn.example.com/submissions/campaign-1/a.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('downloadSubmissionsAsZip', () => {
  beforeEach(() => {
    saveAs.mockClear();
    zipFile.mockClear();
    generateAsync.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['image'])) }),
    );
  });

  it('fetches every submission image, adds it to the zip, and saves one file', async () => {
    const submissions = [makeSubmission({ id: 'a' }), makeSubmission({ id: 'b', fullName: 'Trần Thị B' })];

    const result = await downloadSubmissionsAsZip(submissions, 'my-campaign');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(zipFile).toHaveBeenCalledTimes(2);
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'submissions-my-campaign.zip');
    expect(result).toEqual({ failed: 0 });
  });

  it('counts a failed image fetch instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['image'])),
      }),
    );
    const submissions = [makeSubmission({ id: 'a' }), makeSubmission({ id: 'b' })];

    const result = await downloadSubmissionsAsZip(submissions, 'my-campaign');

    expect(result).toEqual({ failed: 1 });
    expect(zipFile).toHaveBeenCalledTimes(1);
  });

  it('reports progress as images complete', async () => {
    const submissions = [makeSubmission({ id: 'a' }), makeSubmission({ id: 'b' })];
    const onProgress = vi.fn();

    await downloadSubmissionsAsZip(submissions, 'my-campaign', onProgress);

    expect(onProgress).toHaveBeenCalledWith({ completed: 2, total: 2, failed: 0, part: 1, totalParts: 1 });
  });

  it('splits into multiple zip parts once the per-part image cap is exceeded, spacing the downloads out', async () => {
    vi.useFakeTimers();
    try {
      const submissions = Array.from({ length: 501 }, (_, i) => makeSubmission({ id: `submission-${i}` }));

      const runPromise = downloadSubmissionsAsZip(submissions, 'big-campaign');
      await vi.runAllTimersAsync();
      await runPromise;

      expect(saveAs).toHaveBeenCalledTimes(2);
      expect(saveAs).toHaveBeenNthCalledWith(1, expect.any(Blob), 'submissions-big-campaign-phan-1.zip');
      expect(saveAs).toHaveBeenNthCalledWith(2, expect.any(Blob), 'submissions-big-campaign-phan-2.zip');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports the current part and total parts across a multi-part download', async () => {
    vi.useFakeTimers();
    try {
      const submissions = Array.from({ length: 501 }, (_, i) => makeSubmission({ id: `submission-${i}` }));
      const onProgress = vi.fn();

      const runPromise = downloadSubmissionsAsZip(submissions, 'big-campaign', onProgress);
      await vi.runAllTimersAsync();
      await runPromise;

      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ part: 1, totalParts: 2 }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ part: 2, totalParts: 2 }));
    } finally {
      vi.useRealTimers();
    }
  });
});
