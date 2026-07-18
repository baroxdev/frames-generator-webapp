import type { UseMutationOptions } from '@tanstack/react-query';
import { getStorageService } from '../services/storage.service.instance';
import { getSubmissionService } from '../services/submission.service.instance';
import type { SubmitTributeParams } from '../services/submission.service';

/**
 * Centralized, typed mutation option factories for the visitor submission
 * flow, mirroring `campaign.queries.ts`'s pattern: no business logic here,
 * only the caching/loading-state layer TanStack Query provides on top of
 * the corresponding `*.service.ts`.
 */

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
