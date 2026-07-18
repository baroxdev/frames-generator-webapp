import { queryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getStorageService } from '../services/storage.service.instance';
import { getSubmissionService } from '../services/submission.service.instance';
import type { Submission, SubmitTributeParams } from '../services/submission.service';

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

export function uploadSubmissionImageMutationOptions(): UseMutationOptions<
  string,
  Error,
  { campaignId: string; image: Blob }
> {
  return {
    mutationFn: ({ campaignId, image }) => getStorageService().uploadSubmissionImage(campaignId, image),
  };
}

export function submitTributeMutationOptions(): UseMutationOptions<{ id: string }, Error, SubmitTributeParams> {
  return {
    mutationFn: (params) => getSubmissionService().submitTribute(params),
  };
}

/** Callers are responsible for invalidating submissionKeys.listByCampaign(campaignId) and campaignKeys.list() after a successful delete (the campaign's submissionCount changes too). */
export function deleteSubmissionMutationOptions(): UseMutationOptions<{ id: string }, Error, string> {
  return {
    mutationFn: (submissionId) => getSubmissionService().deleteSubmission(submissionId),
  };
}
