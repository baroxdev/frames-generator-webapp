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
  updateCampaignDetailsMutationOptions,
  updateCampaignLayoutMutationOptions,
  updateCampaignSeoMutationOptions,
  uploadCampaignBackgroundMutationOptions,
  uploadCampaignHeaderMutationOptions,
} from './campaign.queries';

const LAYOUT = {
  canvas: { width: 1500, height: 843 },
  avatarBox: { top: 100, left: 100, width: 200, height: 200, shape: 'circle' as const },
  nameBox: { top: 500, left: 100, width: 300, height: 40, textColor: '#ffffff' },
  roleBox: { top: 550, left: 100, width: 300, height: 40, textColor: '#ffffff' },
  messageBox: { top: 100, left: 500, width: 800, height: 400, textColor: '#000000' },
};

const CAMPAIGN = {
  id: 'campaign-1',
  ownerId: 'user-1',
  slug: 'dai-hoi-ben-tre',
  templateId: null,
  layout: LAYOUT,
  backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
  musicUrl: null,
  visibility: 'private' as const,
  status: 'pending' as const,
  submissionCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
  title: null,
  description: null,
  thumbnailUrl: null,
  headerImageUrl: null,
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
      layout: LAYOUT,
      backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
    };
    const mutationFn = createCampaignMutationOptions().mutationFn;
    await mutationFn?.(params, { client: new QueryClient(), meta: undefined });

    expect(createCampaign).toHaveBeenCalledWith(params);
  });

  it('updateCampaignLayoutMutationOptions wraps campaign.service.updateCampaignLayout without adding its own logic', async () => {
    const updateCampaignLayout = vi.fn().mockResolvedValue(CAMPAIGN);
    vi.mocked(getCampaignService).mockReturnValue({ updateCampaignLayout } as unknown as CampaignService);

    const mutationFn = updateCampaignLayoutMutationOptions().mutationFn;
    await mutationFn?.(
      { campaignId: 'campaign-1', layout: LAYOUT },
      { client: new QueryClient(), meta: undefined },
    );

    expect(updateCampaignLayout).toHaveBeenCalledWith('campaign-1', LAYOUT);
  });

  it('updateCampaignSeoMutationOptions wraps campaign.service.updateCampaignSeo without adding its own logic', async () => {
    const updateCampaignSeo = vi.fn().mockResolvedValue(CAMPAIGN);
    vi.mocked(getCampaignService).mockReturnValue({ updateCampaignSeo } as unknown as CampaignService);

    const seo = { title: 'Đại hội Bến Tre', description: 'Gửi lời chúc mừng.', thumbnailUrl: 'https://cdn.example.com/thumb.jpg' };
    const mutationFn = updateCampaignSeoMutationOptions().mutationFn;
    await mutationFn?.({ campaignId: 'campaign-1', seo }, { client: new QueryClient(), meta: undefined });

    expect(updateCampaignSeo).toHaveBeenCalledWith('campaign-1', seo);
  });

  it('uploadCampaignBackgroundMutationOptions wraps storage.service.uploadCampaignBackground without adding its own logic', async () => {
    const uploadCampaignBackground = vi.fn().mockResolvedValue('https://cdn.example.com/bg.jpg');
    vi.mocked(getStorageService).mockReturnValue({ uploadCampaignBackground } as unknown as StorageService);

    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });
    const mutationFn = uploadCampaignBackgroundMutationOptions().mutationFn;
    await mutationFn?.(file, { client: new QueryClient(), meta: undefined });

    expect(uploadCampaignBackground).toHaveBeenCalledWith(file);
  });

  it('uploadCampaignHeaderMutationOptions wraps storage.service.uploadCampaignHeader without adding its own logic', async () => {
    const uploadCampaignHeader = vi.fn().mockResolvedValue('https://cdn.example.com/header.jpg');
    vi.mocked(getStorageService).mockReturnValue({ uploadCampaignHeader } as unknown as StorageService);

    const file = new File(['x'], 'header.jpg', { type: 'image/jpeg' });
    const mutationFn = uploadCampaignHeaderMutationOptions().mutationFn;
    await mutationFn?.(file, { client: new QueryClient(), meta: undefined });

    expect(uploadCampaignHeader).toHaveBeenCalledWith(file);
  });

  it('updateCampaignDetailsMutationOptions wraps campaign.service.updateCampaignDetails without adding its own logic', async () => {
    const updateCampaignDetails = vi.fn().mockResolvedValue(CAMPAIGN);
    vi.mocked(getCampaignService).mockReturnValue({ updateCampaignDetails } as unknown as CampaignService);

    const details = {
      title: 'Đại hội Bến Tre',
      description: 'Gửi lời chúc mừng.',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      headerImageUrl: 'https://cdn.example.com/header.jpg',
      backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
      layout: LAYOUT,
    };
    const mutationFn = updateCampaignDetailsMutationOptions().mutationFn;
    await mutationFn?.({ campaignId: 'campaign-1', details }, { client: new QueryClient(), meta: undefined });

    expect(updateCampaignDetails).toHaveBeenCalledWith('campaign-1', details);
  });
});
