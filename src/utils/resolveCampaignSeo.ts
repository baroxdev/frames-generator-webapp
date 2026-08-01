import type { Campaign } from '../services/campaign.service';

export type ResolvedCampaignSeo = {
  title: string;
  description: string;
  thumbnailUrl: string;
};

const DEFAULT_DESCRIPTION = 'Xem và gửi lời chúc mừng của bạn.';

/**
 * Fills in the owner-editable SEO fields (title, description, thumbnail —
 * all optional, see 0006_campaign_seo_fields.sql) with sensible fallbacks
 * so every campaign always has *something* usable for SEO/share-preview
 * purposes, even one whose owner never filled these in: the slug for a
 * title, a generic call-to-action for a description, and the campaign's
 * own background image as a thumbnail.
 */
export function resolveCampaignSeo(campaign: Campaign): ResolvedCampaignSeo {
  return {
    title: campaign.title?.trim() || `/${campaign.slug}`,
    description: campaign.description?.trim() || DEFAULT_DESCRIPTION,
    thumbnailUrl: campaign.thumbnailUrl || campaign.backgroundImageUrl,
  };
}
