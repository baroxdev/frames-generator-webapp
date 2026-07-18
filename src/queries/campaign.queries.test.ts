import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { CampaignService, CreateCampaignParams } from '../services/campaign.service';
import type { StorageService } from '../services/storage.service';

vi.mock('../services/campaign.service.instance', () => ({ getCampaignService: vi.fn() }));
vi.mock('../services/storage.service.instance', () => ({ getStorageService: vi.fn() }));

import { getCampaignService } from '../services/campaign.service.instance';
import { getStorageService } from '../services/storage.service.instance';
import {
  campaignBySlugQueryOptions,
  campaignKeys,
  campaignsQueryOptions,
  createCampaignMutationOptions,
  slugAvailabilityQueryOptions,
  uploadCampaignBackgroundMutationOptions,
} from './campaign.queries';

const CAMPAIGN = {
  id: 'campaign-1',
  ownerId: 'user-1',
  slug: 'dai-hoi-ben-tre',
  templateId: 'modern-portrait',
  backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
  musicUrl: null,
  visibility: 'private' as const,
  status: 'pending' as const,
  submissionCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
};

describe('campaign.queries', () => {
  it('campaignsQueryOptions fetches through campaign.service and caches under campaignKeys.list()', async () => {
    vi.mocked(getCampaignService).mockReturnValue({
      listCampaignsForOwner: vi.fn().mockResolvedValue([CAMPAIGN]),
    } as unknown as CampaignService);

    const queryClient = new QueryClient();
    const result = await queryClient.fetchQuery(campaignsQueryOptions());

    expect(result).toEqual([CAMPAIGN]);
    expect(queryClient.getQueryData(campaignKeys.list())).toEqual([CAMPAIGN]);
  });

  it('slugAvailabilityQueryOptions fetches through campaign.service, keyed per slug', async () => {
    const isSlugAvailable = vi.fn().mockResolvedValue(true);
    vi.mocked(getCampaignService).mockReturnValue({ isSlugAvailable } as unknown as CampaignService);

    const queryClient = new QueryClient();
    const result = await queryClient.fetchQuery(slugAvailabilityQueryOptions('dai-hoi-ben-tre'));

    expect(result).toBe(true);
    expect(isSlugAvailable).toHaveBeenCalledWith('dai-hoi-ben-tre');
    expect(queryClient.getQueryData(campaignKeys.slugAvailability('dai-hoi-ben-tre'))).toBe(true);
  });

  it('campaignBySlugQueryOptions fetches through campaign.service, keyed per slug, and caches null when not found', async () => {
    const getCampaignBySlug = vi.fn().mockResolvedValue(null);
    vi.mocked(getCampaignService).mockReturnValue({ getCampaignBySlug } as unknown as CampaignService);

    const queryClient = new QueryClient();
    const result = await queryClient.fetchQuery(campaignBySlugQueryOptions('unknown-slug'));

    expect(result).toBeNull();
    expect(getCampaignBySlug).toHaveBeenCalledWith('unknown-slug');
    expect(queryClient.getQueryData(campaignKeys.bySlug('unknown-slug'))).toBeNull();
  });

  it('createCampaignMutationOptions wraps campaign.service.createCampaign without adding its own logic', async () => {
    const createCampaign = vi.fn().mockResolvedValue(CAMPAIGN);
    vi.mocked(getCampaignService).mockReturnValue({ createCampaign } as unknown as CampaignService);

    const params: CreateCampaignParams = {
      slug: 'dai-hoi-ben-tre',
      templateId: 'modern-portrait',
      backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
    };
    const mutationFn = createCampaignMutationOptions().mutationFn;
    await mutationFn?.(params, { client: new QueryClient(), meta: undefined });

    expect(createCampaign).toHaveBeenCalledWith(params);
  });

  it('uploadCampaignBackgroundMutationOptions wraps storage.service.uploadCampaignBackground without adding its own logic', async () => {
    const uploadCampaignBackground = vi.fn().mockResolvedValue('https://cdn.example.com/bg.jpg');
    vi.mocked(getStorageService).mockReturnValue({ uploadCampaignBackground } as unknown as StorageService);

    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });
    const mutationFn = uploadCampaignBackgroundMutationOptions().mutationFn;
    await mutationFn?.(file, { client: new QueryClient(), meta: undefined });

    expect(uploadCampaignBackground).toHaveBeenCalledWith(file);
  });
});
