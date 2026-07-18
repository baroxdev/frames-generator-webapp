import { message } from 'antd';
import { StorageServiceError } from '../services/storage.service';
import { SubmissionServiceError } from '../services/submission.service';

/**
 * Shared catch-block handler for the visitor submission flow, mirroring
 * `report-campaign-error.ts`. Callers that need to distinguish the
 * "campaign full" case should check `error instanceof SubmissionServiceError
 * && error.code === 'CAMPAIGN_FULL'` themselves *before* calling this — this
 * helper only ever shows a toast, so it's for every other failure.
 */
export function reportSubmissionError(error: unknown, fallbackMessage: string): void {
  const friendlyMessage =
    error instanceof SubmissionServiceError || error instanceof StorageServiceError ? error.message : fallbackMessage;
  message.error(friendlyMessage);
}
