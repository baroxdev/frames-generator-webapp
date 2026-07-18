import type { SupabaseClient } from '@supabase/supabase-js';

export type SubmitTributeParams = {
  campaignId: string;
  turnstileToken: string;
  fullName: string;
  role: string;
  message: string;
  /** URL of the final composited tribute frame (background + avatar + text) in R2 — never the visitor's raw avatar photo, which is never uploaded. */
  imageUrl: string;
};

export interface SubmissionService {
  /**
   * Submits a visitor's tribute via the `submit-tribute` Edge Function,
   * which verifies the Turnstile token and atomically enforces the
   * campaign's 5,000-submission cap. Callable while signed out.
   */
  submitTribute(params: SubmitTributeParams): Promise<{ id: string }>;
}

/** Thrown by every submission.service method; `message` is always safe to show a user. */
export class SubmissionServiceError extends Error {
  readonly cause?: unknown;
  /** Set when the campaign has reached its 5,000-submission cap, so callers can show a dedicated "full" state instead of a generic error toast. */
  readonly code?: 'CAMPAIGN_FULL';

  constructor(message: string, options?: { cause?: unknown; code?: 'CAMPAIGN_FULL' }) {
    super(message);
    this.name = 'SubmissionServiceError';
    this.cause = options?.cause;
    this.code = options?.code;
  }
}

const FALLBACK_MESSAGE = 'Không thể gửi thông điệp. Vui lòng thử lại.';

/**
 * `submit-tribute` responds with a JSON body (`{ error, code? }`) even on
 * failure, but the Supabase functions client surfaces a non-2xx response as
 * an opaque `FunctionsHttpError` whose `.context` is the raw `Response` —
 * the body has to be read back out explicitly to recover that message
 * (unlike storage.service.ts's edge functions, this one's specific error
 * text matters: it's what tells the UI a "campaign full" state apart from
 * any other failure).
 */
async function readEdgeFunctionError(error: unknown): Promise<{ message: string; code?: 'CAMPAIGN_FULL' }> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string') {
        return { message: body.error, code: body.code === 'CAMPAIGN_FULL' ? 'CAMPAIGN_FULL' : undefined };
      }
    } catch {
      // Body wasn't JSON (or already consumed) — fall through to the generic message.
    }
  }
  return { message: FALLBACK_MESSAGE };
}

/**
 * Thin wrapper around the `submit-tribute` Edge Function, mirroring
 * `campaign.service.ts`'s pattern: callers depend on this small interface,
 * and the Supabase client is injected so tests can mock it at the SDK
 * boundary.
 */
export function createSubmissionService(client: SupabaseClient): SubmissionService {
  return {
    async submitTribute(params) {
      const { data, error } = await client.functions.invoke<{ id: string }>('submit-tribute', { body: params });
      if (error || !data) {
        const { message, code } = await readEdgeFunctionError(error);
        throw new SubmissionServiceError(message, { cause: error, code });
      }
      return data;
    },
  };
}
