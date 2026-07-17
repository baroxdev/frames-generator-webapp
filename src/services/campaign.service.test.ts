import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CampaignServiceError, createCampaignService } from './campaign.service';

const CAMPAIGN_ROW = {
  id: 'campaign-1',
  owner_id: 'user-1',
  slug: 'dai-hoi-ben-tre',
  template_id: 'modern-portrait',
  background_image_url: 'https://cdn.example.com/campaign-backgrounds/user-1/abc.jpg',
  music_url: null,
  visibility: 'private',
  status: 'pending',
  submission_count: 0,
  created_at: '2026-07-18T00:00:00.000Z',
};

type MockQueryBuilder = {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: unknown) => void) => void;
};

/**
 * Builds a fake Supabase client exposing only the methods the service
 * touches: `rpc`, `auth.getUser`, and a chainable `from(...)` query builder
 * (real Postgrest builders resolve when awaited, however many chain calls
 * precede the await — this mock does the same by making every chain method
 * return itself and resolving with `queryResult` once awaited).
 */
function createMockSupabaseClient(options: {
  rpc?: { data: unknown; error: unknown };
  getUser?: { data: { user: unknown }; error: unknown };
  queryResult?: { data: unknown; error: unknown };
} = {}) {
  const queryResult = options.queryResult ?? { data: null, error: null };
  const builder: MockQueryBuilder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (value: unknown) => void) => resolve(queryResult),
  };

  const client = {
    rpc: vi.fn().mockResolvedValue(options.rpc ?? { data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue(options.getUser ?? { data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn(() => builder),
  };

  return { client: client as unknown as SupabaseClient, builder };
}

describe('campaign.service', () => {
  describe('isSlugAvailable', () => {
    it('returns true when the RPC reports the slug is free', async () => {
      const { client } = createMockSupabaseClient({ rpc: { data: true, error: null } });
      const service = createCampaignService(client);

      await expect(service.isSlugAvailable('dai-hoi-ben-tre')).resolves.toBe(true);
      expect(client.rpc).toHaveBeenCalledWith('is_slug_available', { slug_input: 'dai-hoi-ben-tre' });
    });

    it('returns false when the RPC reports the slug is taken', async () => {
      const { client } = createMockSupabaseClient({ rpc: { data: false, error: null } });
      const service = createCampaignService(client);

      await expect(service.isSlugAvailable('dai-hoi-ben-tre')).resolves.toBe(false);
    });

    it('throws a friendly CampaignServiceError when the RPC fails', async () => {
      const { client } = createMockSupabaseClient({ rpc: { data: null, error: { message: 'network error' } } });
      const service = createCampaignService(client);

      await expect(service.isSlugAvailable('dai-hoi-ben-tre')).rejects.toBeInstanceOf(CampaignServiceError);
    });
  });

  describe('createCampaign', () => {
    it('creates the campaign scoped to the authenticated owner and returns it mapped to camelCase', async () => {
      const { client } = createMockSupabaseClient({ queryResult: { data: CAMPAIGN_ROW, error: null } });
      const service = createCampaignService(client);

      const result = await service.createCampaign({
        slug: 'dai-hoi-ben-tre',
        templateId: 'modern-portrait',
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
      });

      expect(result).toEqual({
        id: 'campaign-1',
        ownerId: 'user-1',
        slug: 'dai-hoi-ben-tre',
        templateId: 'modern-portrait',
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
        musicUrl: null,
        visibility: 'private',
        status: 'pending',
        submissionCount: 0,
        createdAt: '2026-07-18T00:00:00.000Z',
      });
      expect(client.from).toHaveBeenCalledWith('campaigns');
    });

    it('inserts with visibility=private and status=pending regardless of caller input', async () => {
      const { client, builder } = createMockSupabaseClient({ queryResult: { data: CAMPAIGN_ROW, error: null } });
      const service = createCampaignService(client);

      await service.createCampaign({
        slug: 'dai-hoi-ben-tre',
        templateId: 'modern-portrait',
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
      });

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'private', status: 'pending', owner_id: 'user-1' }),
      );
    });

    it('throws a "slug taken" CampaignServiceError on a unique-constraint violation', async () => {
      const { client } = createMockSupabaseClient({
        queryResult: { data: null, error: { code: '23505', message: 'duplicate key value' } },
      });
      const service = createCampaignService(client);

      await expect(
        service.createCampaign({ slug: 'dai-hoi-ben-tre', templateId: 'modern-portrait', backgroundImageUrl: 'x' }),
      ).rejects.toThrow(/đã được sử dụng/);
    });

    it('throws a CampaignServiceError when there is no authenticated user', async () => {
      const { client } = createMockSupabaseClient({ getUser: { data: { user: null }, error: null } });
      const service = createCampaignService(client);

      await expect(
        service.createCampaign({ slug: 'dai-hoi-ben-tre', templateId: 'modern-portrait', backgroundImageUrl: 'x' }),
      ).rejects.toBeInstanceOf(CampaignServiceError);
    });
  });

  describe('listCampaignsForOwner', () => {
    it('lists campaigns scoped to the authenticated owner, newest first', async () => {
      const { client, builder } = createMockSupabaseClient({ queryResult: { data: [CAMPAIGN_ROW], error: null } });
      const service = createCampaignService(client);

      const result = await service.listCampaignsForOwner();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('dai-hoi-ben-tre');
      expect(builder.eq).toHaveBeenCalledWith('owner_id', 'user-1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('throws a friendly CampaignServiceError when the query fails', async () => {
      const { client } = createMockSupabaseClient({ queryResult: { data: null, error: { message: 'network error' } } });
      const service = createCampaignService(client);

      await expect(service.listCampaignsForOwner()).rejects.toBeInstanceOf(CampaignServiceError);
    });
  });
});
