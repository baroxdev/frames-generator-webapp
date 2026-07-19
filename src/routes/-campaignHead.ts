import type { Campaign } from '../services/campaign.service';
import { resolveCampaignSeo } from '../utils/resolveCampaignSeo';

const NOT_FOUND_TITLE = 'Không tìm thấy chiến dịch';
const NOT_FOUND_DESCRIPTION = 'Đường dẫn này không tồn tại hoặc chiến dịch chưa được duyệt.';

/**
 * Pure `campaign -> meta tag array` mapping for the `/$slug` route — the one
 * new seam that route introduces (everything else it composes,
 * `getCampaignBySlug` and `resolveCampaignSeo`, is reused unchanged and
 * already tested). `campaign === null` covers both "slug never registered"
 * and "pending/rejected/suspended" on purpose, so the not-found fallback
 * here must not leak which case it was — same rule `CampaignPublicPage`'s
 * `NotFoundPage` branch already follows.
 */
export function campaignHead(campaign: Campaign | null) {
  if (!campaign) {
    return {
      meta: [
        { title: NOT_FOUND_TITLE },
        { name: 'description', content: NOT_FOUND_DESCRIPTION },
        { property: 'og:title', content: NOT_FOUND_TITLE },
        { property: 'og:description', content: NOT_FOUND_DESCRIPTION },
      ],
    };
  }

  const seo = resolveCampaignSeo(campaign);
  return {
    meta: [
      { title: seo.title },
      { name: 'description', content: seo.description },
      { property: 'og:title', content: seo.title },
      { property: 'og:description', content: seo.description },
      { property: 'og:image', content: seo.thumbnailUrl },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: seo.title },
      { name: 'twitter:description', content: seo.description },
      { name: 'twitter:image', content: seo.thumbnailUrl },
    ],
  };
}
