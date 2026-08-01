import { message } from 'antd';
import { CampaignServiceError } from '../services/campaign.service';
import { StorageServiceError } from '../services/storage.service';

/**
 * Shared catch-block handler for campaign mutations, mirroring
 * `report-auth-error.ts`: shows the service's friendly message when there
 * is one (CampaignServiceError or StorageServiceError), otherwise a
 * page-specific fallback for anything unexpected (network errors, etc.).
 */
export function reportCampaignError(error: unknown, fallbackMessage: string): void {
  const friendlyMessage =
    error instanceof CampaignServiceError || error instanceof StorageServiceError ? error.message : fallbackMessage;
  message.error(friendlyMessage);
}
