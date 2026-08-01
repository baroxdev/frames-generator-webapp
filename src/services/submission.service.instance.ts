import { createSubmissionService, type SubmissionService } from './submission.service';
import { getSupabaseClient } from '../lib/supabase-client';

let cachedInstance: SubmissionService | null = null;

/**
 * The app's single `SubmissionService` instance, wired to the real Supabase
 * client. Kept separate from `submission.service.ts` so that module stays
 * free of any dependency on env/config — tests import `createSubmissionService`
 * directly and inject a mock client instead of going through this singleton.
 */
export function getSubmissionService(): SubmissionService {
  if (!cachedInstance) {
    cachedInstance = createSubmissionService(getSupabaseClient());
  }
  return cachedInstance;
}
