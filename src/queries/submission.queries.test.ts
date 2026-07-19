import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { SubmissionService } from '../services/submission.service';

vi.mock('../services/submission.service.instance', () => ({ getSubmissionService: vi.fn() }));

const { mockSubmitTributeServerFn, mockUploadSubmissionImage } = vi.hoisted(() => ({
  mockSubmitTributeServerFn: vi.fn(),
  mockUploadSubmissionImage: vi.fn(),
}));
vi.mock('../lib/submitTributeServerFn', () => ({
  submitTributeServerFn: mockSubmitTributeServerFn,
}));
vi.mock('../lib/uploadSubmissionImage', () => ({
  uploadSubmissionImage: mockUploadSubmissionImage,
}));

import { getSubmissionService } from '../services/submission.service.instance';
import { SubmissionServiceError } from '../services/submission.service';
import {
  deleteSubmissionMutationOptions,
  submissionsByCampaignQueryOptions,
  submitTributeMutationOptions,
  uploadSubmissionImageMutationOptions,
} from './submission.queries';

describe('submission.queries', () => {
  it('uploadSubmissionImageMutationOptions wraps uploadSubmissionImage without adding its own logic', async () => {
    mockUploadSubmissionImage.mockReset().mockResolvedValue('https://cdn.example.com/submissions/campaign-1/a.jpg');

    const image = new Blob(['x'], { type: 'image/jpeg' });
    const mutationFn = uploadSubmissionImageMutationOptions().mutationFn;
    await mutationFn?.({ campaignId: 'campaign-1', image }, { client: new QueryClient(), meta: undefined });

    expect(mockUploadSubmissionImage).toHaveBeenCalledWith('campaign-1', image);
  });

  const TRIBUTE_PARAMS = {
    campaignId: 'campaign-1',
    turnstileToken: 'token-abc',
    fullName: 'Nguyễn Văn A',
    role: 'Cựu học sinh',
    message: 'Chúc mừng đại hội!',
    imageUrl: 'https://cdn.example.com/submissions/campaign-1/a.jpg',
  };

  it('submitTributeMutationOptions calls submitTributeServerFn (not Supabase directly) and returns the id on success', async () => {
    mockSubmitTributeServerFn.mockReset().mockResolvedValue({ ok: true, id: 'submission-1' });

    const mutationFn = submitTributeMutationOptions().mutationFn;
    const result = await mutationFn?.(TRIBUTE_PARAMS, { client: new QueryClient(), meta: undefined });

    expect(mockSubmitTributeServerFn).toHaveBeenCalledWith({ data: TRIBUTE_PARAMS });
    expect(result).toEqual({ id: 'submission-1' });
  });

  it('submitTributeMutationOptions re-throws a SubmissionServiceError (with code) when the server function reports failure', async () => {
    mockSubmitTributeServerFn.mockReset().mockResolvedValue({
      ok: false,
      message: 'Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.',
      code: 'CAMPAIGN_FULL',
    });

    const mutationFn = submitTributeMutationOptions().mutationFn;
    await expect(
      mutationFn?.(TRIBUTE_PARAMS, { client: new QueryClient(), meta: undefined }),
    ).rejects.toMatchObject(
      new SubmissionServiceError('Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.', { code: 'CAMPAIGN_FULL' }),
    );
  });

  it('submissionsByCampaignQueryOptions wraps submission.service.listSubmissionsForCampaign without adding its own logic', async () => {
    const submissions = [
      {
        id: 'submission-1',
        campaignId: 'campaign-1',
        fullName: 'Nguyễn Văn A',
        role: 'Cựu học sinh',
        message: 'Chúc mừng đại hội!',
        imageUrl: 'https://cdn.example.com/submissions/campaign-1/a.jpg',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const listSubmissionsForCampaign = vi.fn().mockResolvedValue(submissions);
    vi.mocked(getSubmissionService).mockReturnValue({ listSubmissionsForCampaign } as unknown as SubmissionService);

    const options = submissionsByCampaignQueryOptions('campaign-1');
    const result = await options.queryFn?.({} as never);

    expect(listSubmissionsForCampaign).toHaveBeenCalledWith('campaign-1');
    expect(result).toEqual(submissions);
    expect(options.queryKey).toEqual(['submissions', 'by-campaign', 'campaign-1']);
  });

  it('deleteSubmissionMutationOptions wraps submission.service.deleteSubmission without adding its own logic', async () => {
    const deleteSubmission = vi.fn().mockResolvedValue({ id: 'submission-1' });
    vi.mocked(getSubmissionService).mockReturnValue({ deleteSubmission } as unknown as SubmissionService);

    const mutationFn = deleteSubmissionMutationOptions().mutationFn;
    await mutationFn?.('submission-1', { client: new QueryClient(), meta: undefined });

    expect(deleteSubmission).toHaveBeenCalledWith('submission-1');
  });
});
