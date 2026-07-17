import { createCampaignService, type CampaignService } from './campaign.service';
import { getSupabaseClient } from '../lib/supabase-client';

let cachedInstance: CampaignService | null = null;

/**
 * The app's single `CampaignService` instance, wired to the real Supabase
 * client. Kept separate from `campaign.service.ts` so that module stays free
 * of any dependency on env/config — tests import `createCampaignService`
 * directly and inject a mock client instead of going through this singleton.
 */
export function getCampaignService(): CampaignService {
  if (!cachedInstance) {
    cachedInstance = createCampaignService(getSupabaseClient());
  }
  return cachedInstance;
}
