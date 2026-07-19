import { queryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getSubmissionService } from '../services/submission.service.instance';
import { SubmissionServiceError, type Submission, type SubmitTributeParams } from '../services/submission.service';
import { submitTributeServerFn } from '../lib/submitTributeServerFn';
import { uploadSubmissionImage } from '../lib/uploadSubmissionImage';

/**
 * Centralized, typed query keys + mutation option factories for the
 * submission domain (visitor submission flow + owner dashboard), mirroring
 * `campaign.queries.ts`'s pattern: no business logic here, only the
 * caching/loading-state layer TanStack Query provides on top of
 * `submission.service.ts`.
 */
export const submissionKeys = {
  all: ['submissions'] as const,
  listByCampaign: (campaignId: string) => [...submissionKeys.all, 'by-campaign', campaignId] as const,
};

/** Powers the owner's private submissions dashboard (ticket #7). */
export function submissionsByCampaignQueryOptions(campaignId: string) {
  return queryOptions({
    queryKey: submissionKeys.listByCampaign(campaignId),
    queryFn: (): Promise<Submission[]> => getSubmissionService().listSubmissionsForCampaign(campaignId),
  });
}

/**
 * Compresses and uploads the visitor's composited tribute image via
 * `uploadSubmissionImage` (see that module for why only the presign step
 * moves server-side, not the file body).
 */
export function uploadSubmissionImageMutationOptions(): UseMutationOptions<
  string,
  Error,
  { campaignId: string; image: Blob }
> {
  return {
    mutationFn: ({ campaignId, image }) => uploadSubmissionImage(campaignId, image),
  };
}

/**
 * Routes the visitor's tribute submission through the `submitTributeServerFn`
 * server function instead of calling Supabase directly from the browser
 * (see that module's doc comment for why errors come back as a plain result
 * object here, and get re-thrown as the real `SubmissionServiceError` the
 * rest of the app already expects).
 */
export function submitTributeMutationOptions(): UseMutationOptions<{ id: string }, Error, SubmitTributeParams> {
  return {
    mutationFn: async (params) => {
      const result = await submitTributeServerFn({ data: params });
      if (!result.ok) {
        throw new SubmissionServiceError(result.message, { code: result.code });
      }
      return { id: result.id };
    },
  };
}

/** Callers are responsible for invalidating submissionKeys.listByCampaign(campaignId) and campaignKeys.list() after a successful delete (the campaign's submissionCount changes too). */
export function deleteSubmissionMutationOptions(): UseMutationOptions<{ id: string }, Error, string> {
  return {
    mutationFn: (submissionId) => getSubmissionService().deleteSubmission(submissionId),
  };
}
