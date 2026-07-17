import type { SupabaseClient } from '@supabase/supabase-js';

export type CampaignVisibility = 'private' | 'public';
export type CampaignStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Campaign {
  id: string;
  ownerId: string;
  slug: string;
  templateId: string;
  backgroundImageUrl: string;
  musicUrl: string | null;
  visibility: CampaignVisibility;
  status: CampaignStatus;
  submissionCount: number;
  createdAt: string;
}

export type CreateCampaignParams = {
  slug: string;
  templateId: string;
  backgroundImageUrl: string;
};

export interface CampaignService {
  isSlugAvailable(slug: string): Promise<boolean>;
  createCampaign(params: CreateCampaignParams): Promise<Campaign>;
  listCampaignsForOwner(): Promise<Campaign[]>;
}

/** Thrown by every campaign.service method; `message` is always safe to show a user. */
export class CampaignServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'CampaignServiceError';
    this.cause = options?.cause;
  }
}

const FALLBACK_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
// Postgres unique_violation — see the `slug` unique constraint in
// supabase/migrations/0001_campaigns.sql, the authoritative uniqueness
// guard (isSlugAvailable is only a pre-submit convenience check and can
// race a concurrent creation).
const UNIQUE_VIOLATION = '23505';

type CampaignRow = {
  id: string;
  owner_id: string;
  slug: string;
  template_id: string;
  background_image_url: string;
  music_url: string | null;
  visibility: CampaignVisibility;
  status: CampaignStatus;
  submission_count: number;
  created_at: string;
};

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    templateId: row.template_id,
    backgroundImageUrl: row.background_image_url,
    musicUrl: row.music_url,
    visibility: row.visibility,
    status: row.status,
    submissionCount: row.submission_count,
    createdAt: row.created_at,
  };
}

/** Every campaign.service method scopes its query to the caller's own rows, so each needs the current user's id first. */
async function requireUser(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new CampaignServiceError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', { cause: error });
  }
  return user;
}

/**
 * Thin wrapper around the Supabase `campaigns` table, mirroring
 * `auth.service.ts`'s pattern: callers depend on this small interface
 * instead of the Supabase SDK directly, and the client is injected so tests
 * can supply a mock at the SDK boundary instead of hitting a live backend.
 */
export function createCampaignService(client: SupabaseClient): CampaignService {
  return {
    async isSlugAvailable(slug) {
      const { data, error } = await client.rpc('is_slug_available', { slug_input: slug });
      if (error) {
        throw new CampaignServiceError('Không thể kiểm tra đường dẫn. Vui lòng thử lại.', { cause: error });
      }
      return Boolean(data);
    },

    async createCampaign({ slug, templateId, backgroundImageUrl }) {
      const user = await requireUser(client);

      const { data, error } = await client
        .from('campaigns')
        .insert({
          owner_id: user.id,
          slug,
          template_id: templateId,
          background_image_url: backgroundImageUrl,
          visibility: 'private',
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          throw new CampaignServiceError('Đường dẫn này đã được sử dụng. Vui lòng chọn đường dẫn khác.', {
            cause: error,
          });
        }
        throw new CampaignServiceError(FALLBACK_MESSAGE, { cause: error });
      }

      return toCampaign(data as CampaignRow);
    },

    async listCampaignsForOwner() {
      const user = await requireUser(client);

      const { data, error } = await client
        .from('campaigns')
        .select()
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new CampaignServiceError('Không thể tải danh sách chiến dịch. Vui lòng thử lại.', { cause: error });
      }

      return (data as CampaignRow[]).map(toCampaign);
    },
  };
}
