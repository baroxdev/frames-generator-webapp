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

export function uploadSubmissionAvatarMutationOptions(): UseMutationOptions<
  string,
  Error,
  { campaignId: string; file: File }
> {
  return {
    mutationFn: ({ campaignId, file }) => getStorageService().uploadSubmissionAvatar(campaignId, file),
  };
}

export function submitTributeMutationOptions(): UseMutationOptions<{ id: string }, Error, SubmitTributeParams> {
  return {
    mutationFn: (params) => getSubmissionService().submitTribute(params),
  };
}
