import type { CampaignLayout, Template } from './types';

/**
 * Adapts a campaign's own free-form `layout` into the `Template` shape
 * `PrintArea` renders — `CampaignLayout` is `Template` minus the
 * gallery-identity fields (`id`/`name`/`description`) and `background`
 * (which lives on the campaign row, not the layout). Used by both the
 * layout editor and the public campaign page so the two don't drift.
 */
export function campaignLayoutToTemplate(id: string, backgroundImageUrl: string, layout: CampaignLayout): Template {
  return { id, name: '', description: '', background: backgroundImageUrl, ...layout };
}
