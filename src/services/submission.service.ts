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

export interface Submission {
  id: string;
  campaignId: string;
  fullName: string;
  role: string;
  message: string;
  /** The composited tribute frame in R2 — same URL submitTribute submitted, never the visitor's raw avatar photo. */
  imageUrl: string;
  createdAt: string;
}

export interface SubmissionService {
  /**
   * Submits a visitor's tribute via the `submit-tribute` Edge Function,
   * which verifies the Turnstile token and atomically enforces the
   * campaign's 5,000-submission cap. Callable while signed out.
   */
  submitTribute(params: SubmitTributeParams): Promise<{ id: string }>;
  /**
   * Lists every submission belonging to one campaign, newest first, for the
   * owner's private dashboard (ticket #7). Relies on the owner-scoped RLS
   * policy added in 0005_owner_submissions_dashboard.sql to actually scope
   * the rows returned — the explicit session check below isn't the
   * authorization boundary, it exists so an expired session surfaces the
   * same friendly "session expired" message every other owner-scoped
   * service method gives (campaign.service.ts's `requireUser`) instead of
   * RLS quietly returning zero rows, which would be indistinguishable from
   * a campaign that genuinely has no submissions yet.
   */
  listSubmissionsForCampaign(campaignId: string): Promise<Submission[]>;
  /**
   * Deletes one submission via the `delete-submission` Edge Function, which
   * also removes its R2 avatar object and decrements the campaign's
   * submission count. See that function for why this can't just be a
   * client-side RLS DELETE.
   */
  deleteSubmission(submissionId: string): Promise<{ id: string }>;
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
const DELETE_FALLBACK_MESSAGE = 'Không thể xoá thông điệp. Vui lòng thử lại.';
const LIST_FALLBACK_MESSAGE = 'Không thể tải danh sách thông điệp. Vui lòng thử lại.';

// PostgREST caps rows per request (default 1000); listSubmissionsForCampaign
// pages through in chunks of this size so a campaign with 2,000+ submissions
// still loads in full rather than silently truncating at the first page.
const LIST_PAGE_SIZE = 1000;

type SubmissionRow = {
  id: string;
  campaign_id: string;
  full_name: string;
  role: string;
  message: string;
  image_url: string;
  created_at: string;
};

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    fullName: row.full_name,
    role: row.role,
    message: row.message,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

/**
 * `submit-tribute` and `delete-submission` respond with a JSON body
 * (`{ error, code? }`) even on failure, but the Supabase functions client
 * surfaces a non-2xx response as an opaque `FunctionsHttpError` whose
 * `.context` is the raw `Response` — the body has to be read back out
 * explicitly to recover that message (unlike storage.service.ts's edge
 * functions, these functions' specific error text matters: it's what tells
 * the UI a "campaign full" state apart from any other failure).
 */
async function readEdgeFunctionError(
  error: unknown,
  fallbackMessage: string,
): Promise<{ message: string; code?: 'CAMPAIGN_FULL' }> {
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
  return { message: fallbackMessage };
}

/** Mirrors campaign.service.ts's `requireUser` — see listSubmissionsForCampaign's doc comment for why this service needs its own copy too. */
async function requireUser(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new SubmissionServiceError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', { cause: error });
  }
  return user;
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
        const { message, code } = await readEdgeFunctionError(error, FALLBACK_MESSAGE);
        throw new SubmissionServiceError(message, { cause: error, code });
      }
      return data;
    },

    async listSubmissionsForCampaign(campaignId) {
      await requireUser(client);

      const rows: SubmissionRow[] = [];
      let from = 0;

      for (;;) {
        const { data, error } = await client
          .from('submissions')
          .select()
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .range(from, from + LIST_PAGE_SIZE - 1);

        if (error) {
          throw new SubmissionServiceError(LIST_FALLBACK_MESSAGE, { cause: error });
        }

        const page = (data ?? []) as SubmissionRow[];
        rows.push(...page);

        if (page.length < LIST_PAGE_SIZE) break;
        from += LIST_PAGE_SIZE;
      }

      return rows.map(toSubmission);
    },

    async deleteSubmission(submissionId) {
      const { data, error } = await client.functions.invoke<{ id: string }>('delete-submission', {
        body: { submissionId },
      });
      if (error || !data) {
        const { message } = await readEdgeFunctionError(error, DELETE_FALLBACK_MESSAGE);
        throw new SubmissionServiceError(message, { cause: error });
      }
      return data;
    },
  };
}
