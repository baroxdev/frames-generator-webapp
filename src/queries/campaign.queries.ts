import { queryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getCampaignService } from '../services/campaign.service.instance';
import { getStorageService } from '../services/storage.service.instance';
import type { Campaign, CreateCampaignParams } from '../services/campaign.service';
import type { CampaignLayout } from '../templates';

/**
 * Centralized, typed query keys for the campaign domain, mirroring
 * `auth.queries.ts`'s `authKeys` pattern.
 */
export const campaignKeys = {
  all: ['campaigns'] as const,
  list: () => [...campaignKeys.all, 'list'] as const,
  slugAvailability: (slug: string) => [...campaignKeys.all, 'slug-availability', slug] as const,
  bySlug: (slug: string) => [...campaignKeys.all, 'by-slug', slug] as const,
};

export function campaignsQueryOptions() {
  return queryOptions({
    queryKey: campaignKeys.list(),
    queryFn: (): Promise<Campaign[]> => getCampaignService().listCampaignsForOwner(),
  });
}

/**
 * Powers the live "is this slug taken" check on the create-campaign form.
 * Callers should pass `enabled: false` (via query option overrides) while
 * `slug` fails local format validation, so this never fires a request for
 * an obviously-invalid slug.
 */
export function slugAvailabilityQueryOptions(slug: string) {
  return queryOptions({
    queryKey: campaignKeys.slugAvailability(slug),
    queryFn: (): Promise<boolean> => getCampaignService().isSlugAvailable(slug),
    staleTime: 0,
  });
}

/** Powers the public /:slug campaign page — callable while signed out. */
export function campaignBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: campaignKeys.bySlug(slug),
    queryFn: (): Promise<Campaign | null> => getCampaignService().getCampaignBySlug(slug),
  });
}

// Mutation option factories below wrap the service layer one-for-one, same
// as auth.queries.ts — no business logic of their own, only the
// caching/loading-state layer TanStack Query provides. Callers are
// responsible for invalidating campaignKeys.list() after a successful
// create, same as any other cache consumer.

export function createCampaignMutationOptions(): UseMutationOptions<Campaign, Error, CreateCampaignParams> {
  return {
    mutationFn: (params) => getCampaignService().createCampaign(params),
  };
}

export function uploadCampaignBackgroundMutationOptions(): UseMutationOptions<string, Error, File> {
  return {
    mutationFn: (file) => getStorageService().uploadCampaignBackground(file),
  };
}

/** Powers both the creation-time editor's save step and the standalone re-edit flow. */
export function updateCampaignLayoutMutationOptions(): UseMutationOptions<
  Campaign,
  Error,
  { campaignId: string; layout: CampaignLayout }
> {
  return {
    mutationFn: ({ campaignId, layout }) => getCampaignService().updateCampaignLayout(campaignId, layout),
  };
}
