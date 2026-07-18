import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { StorageService } from '../services/storage.service';
import type { SubmissionService } from '../services/submission.service';

vi.mock('../services/storage.service.instance', () => ({ getStorageService: vi.fn() }));
vi.mock('../services/submission.service.instance', () => ({ getSubmissionService: vi.fn() }));

import { getStorageService } from '../services/storage.service.instance';
import { getSubmissionService } from '../services/submission.service.instance';
import { submitTributeMutationOptions, uploadSubmissionAvatarMutationOptions } from './submission.queries';

describe('submission.queries', () => {
  it('uploadSubmissionAvatarMutationOptions wraps storage.service.uploadSubmissionAvatar without adding its own logic', async () => {
    const uploadSubmissionAvatar = vi.fn().mockResolvedValue('https://cdn.example.com/submissions/campaign-1/a.jpg');
    vi.mocked(getStorageService).mockReturnValue({ uploadSubmissionAvatar } as unknown as StorageService);

    const file = new File(['x'], 'avatar.jpg', { type: 'image/jpeg' });
    const mutationFn = uploadSubmissionAvatarMutationOptions().mutationFn;
    await mutationFn?.({ campaignId: 'campaign-1', file }, { client: new QueryClient(), meta: undefined });

    expect(uploadSubmissionAvatar).toHaveBeenCalledWith('campaign-1', file);
  });

  it('submitTributeMutationOptions wraps submission.service.submitTribute without adding its own logic', async () => {
    const submitTribute = vi.fn().mockResolvedValue({ id: 'submission-1' });
    vi.mocked(getSubmissionService).mockReturnValue({ submitTribute } as unknown as SubmissionService);

    const params = {
      campaignId: 'campaign-1',
      turnstileToken: 'token-abc',
      fullName: 'Nguyễn Văn A',
      role: 'Cựu học sinh',
      message: 'Chúc mừng đại hội!',
      avatarUrl: 'https://cdn.example.com/submissions/campaign-1/a.jpg',
    };
    const mutationFn = submitTributeMutationOptions().mutationFn;
    await mutationFn?.(params, { client: new QueryClient(), meta: undefined });

    expect(submitTribute).toHaveBeenCalledWith(params);
  });
});
