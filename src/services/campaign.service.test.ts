import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CampaignServiceError, createCampaignService } from './campaign.service';

const LAYOUT = {
  canvas: { width: 1500, height: 843 },
  avatarBox: { top: 100, left: 100, width: 200, height: 200, shape: 'circle' as const },
  nameBox: { top: 500, left: 100, width: 300, height: 40, textColor: '#ffffff' },
  roleBox: { top: 550, left: 100, width: 300, height: 40, textColor: '#ffffff' },
  messageBox: { top: 100, left: 500, width: 800, height: 400, textColor: '#000000' },
};

const CAMPAIGN_ROW = {
  id: 'campaign-1',
  owner_id: 'user-1',
  slug: 'dai-hoi-ben-tre',
  template_id: null,
  layout: LAYOUT,
  background_image_url: 'https://cdn.example.com/campaign-backgrounds/user-1/abc.jpg',
  music_url: null,
  visibility: 'private',
  status: 'pending',
  submission_count: 0,
  created_at: '2026-07-18T00:00:00.000Z',
  title: null,
  description: null,
  thumbnail_url: null,
};

type MockQueryBuilder = {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
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
    maybeSingle: vi.fn(() => builder),
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
        layout: LAYOUT,
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
      });

      expect(result).toEqual({
        id: 'campaign-1',
        ownerId: 'user-1',
        slug: 'dai-hoi-ben-tre',
        templateId: null,
        layout: LAYOUT,
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
        musicUrl: null,
        visibility: 'private',
        status: 'pending',
        submissionCount: 0,
        createdAt: '2026-07-18T00:00:00.000Z',
        title: null,
        description: null,
        thumbnailUrl: null,
      });
      expect(client.from).toHaveBeenCalledWith('campaigns');
    });

    it('inserts the optional SEO fields when provided, and null when omitted', async () => {
      const { client, builder } = createMockSupabaseClient({ queryResult: { data: CAMPAIGN_ROW, error: null } });
      const service = createCampaignService(client);

      await service.createCampaign({
        slug: 'dai-hoi-ben-tre',
        layout: LAYOUT,
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
        title: 'Đại hội Bến Tre',
        description: 'Gửi lời chúc mừng của bạn.',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      });

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Đại hội Bến Tre',
          description: 'Gửi lời chúc mừng của bạn.',
          thumbnail_url: 'https://cdn.example.com/thumb.jpg',
        }),
      );

      await service.createCampaign({
        slug: 'dai-hoi-ben-tre',
        layout: LAYOUT,
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
      });

      expect(builder.insert).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: null, description: null, thumbnail_url: null }),
      );
    });

    it('inserts with visibility=private and status=pending regardless of caller input', async () => {
      const { client, builder } = createMockSupabaseClient({ queryResult: { data: CAMPAIGN_ROW, error: null } });
      const service = createCampaignService(client);

      await service.createCampaign({
        slug: 'dai-hoi-ben-tre',
        layout: LAYOUT,
        backgroundImageUrl: CAMPAIGN_ROW.background_image_url,
      });

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'private', status: 'pending', owner_id: 'user-1', layout: LAYOUT }),
      );
    });

    it('throws a "slug taken" CampaignServiceError on a unique-constraint violation', async () => {
      const { client } = createMockSupabaseClient({
        queryResult: { data: null, error: { code: '23505', message: 'duplicate key value' } },
      });
      const service = createCampaignService(client);

      await expect(
        service.createCampaign({ slug: 'dai-hoi-ben-tre', layout: LAYOUT, backgroundImageUrl: 'x' }),
      ).rejects.toThrow(/đã được sử dụng/);
    });

    it('throws a CampaignServiceError when there is no authenticated user', async () => {
      const { client } = createMockSupabaseClient({ getUser: { data: { user: null }, error: null } });
      const service = createCampaignService(client);

      await expect(
        service.createCampaign({ slug: 'dai-hoi-ben-tre', layout: LAYOUT, backgroundImageUrl: 'x' }),
      ).rejects.toBeInstanceOf(CampaignServiceError);
    });
  });

  describe('updateCampaignLayout', () => {
    it('calls the set_campaign_layout RPC and returns the updated campaign mapped to camelCase', async () => {
      const { client } = createMockSupabaseClient({ rpc: { data: CAMPAIGN_ROW, error: null } });
      const service = createCampaignService(client);

      const result = await service.updateCampaignLayout('campaign-1', LAYOUT);

      expect(client.rpc).toHaveBeenCalledWith('set_campaign_layout', {
        campaign_id_input: 'campaign-1',
        layout_input: LAYOUT,
      });
      expect(result.layout).toEqual(LAYOUT);
    });

    it('throws a friendly CampaignServiceError when the RPC fails', async () => {
      const { client } = createMockSupabaseClient({ rpc: { data: null, error: { message: 'not found' } } });
      const service = createCampaignService(client);

      await expect(service.updateCampaignLayout('campaign-1', LAYOUT)).rejects.toBeInstanceOf(CampaignServiceError);
    });
  });

  describe('updateCampaignSeo', () => {
    it('calls the set_campaign_seo RPC and returns the updated campaign mapped to camelCase', async () => {
      const updatedRow = {
        ...CAMPAIGN_ROW,
        title: 'Đại hội Bến Tre',
        description: 'Gửi lời chúc mừng của bạn.',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      };
      const { client } = createMockSupabaseClient({ rpc: { data: updatedRow, error: null } });
      const service = createCampaignService(client);

      const result = await service.updateCampaignSeo('campaign-1', {
        title: 'Đại hội Bến Tre',
        description: 'Gửi lời chúc mừng của bạn.',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      });

      expect(client.rpc).toHaveBeenCalledWith('set_campaign_seo', {
        campaign_id_input: 'campaign-1',
        title_input: 'Đại hội Bến Tre',
        description_input: 'Gửi lời chúc mừng của bạn.',
        thumbnail_url_input: 'https://cdn.example.com/thumb.jpg',
      });
      expect(result.title).toBe('Đại hội Bến Tre');
      expect(result.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
    });

    it('throws a friendly CampaignServiceError when the RPC fails', async () => {
      const { client } = createMockSupabaseClient({ rpc: { data: null, error: { message: 'not found' } } });
      const service = createCampaignService(client);

      await expect(
        service.updateCampaignSeo('campaign-1', { title: null, description: null, thumbnailUrl: null }),
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

  describe('getCampaignBySlug', () => {
    it('returns the campaign mapped to camelCase when RLS allows the row through (approved, or owned by the caller)', async () => {
      const { client, builder } = createMockSupabaseClient({ queryResult: { data: CAMPAIGN_ROW, error: null } });
      const service = createCampaignService(client);

      const result = await service.getCampaignBySlug('dai-hoi-ben-tre');

      expect(result?.slug).toBe('dai-hoi-ben-tre');
      expect(builder.eq).toHaveBeenCalledWith('slug', 'dai-hoi-ben-tre');
      // No auth.getUser() guard here — this is the one method a signed-out
      // visitor calls, so it must not require a session.
      expect(client.auth.getUser).not.toHaveBeenCalled();
    });

    it('returns null (not a thrown error) when no row is visible — RLS makes a pending/rejected/suspended campaign and a nonexistent slug indistinguishable', async () => {
      const { client } = createMockSupabaseClient({ queryResult: { data: null, error: null } });
      const service = createCampaignService(client);

      await expect(service.getCampaignBySlug('not-approved-or-missing')).resolves.toBeNull();
    });

    it('throws a CampaignServiceError instead of returning malformed data when the row layout fails validation (never trust external data, even our own jsonb column)', async () => {
      const { client } = createMockSupabaseClient({
        queryResult: { data: { ...CAMPAIGN_ROW, layout: { canvas: LAYOUT.canvas } }, error: null },
      });
      const service = createCampaignService(client);

      await expect(service.getCampaignBySlug('dai-hoi-ben-tre')).rejects.toBeInstanceOf(CampaignServiceError);
    });

    it('throws a friendly CampaignServiceError on an actual query failure', async () => {
      const { client } = createMockSupabaseClient({ queryResult: { data: null, error: { message: 'network error' } } });
      const service = createCampaignService(client);

      await expect(service.getCampaignBySlug('dai-hoi-ben-tre')).rejects.toBeInstanceOf(CampaignServiceError);
    });
  });
});
