import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { SubmissionServiceError, createSubmissionService } from './submission.service';

function createMockSupabaseClient(
  overrides: {
    invoke?: ReturnType<typeof vi.fn>;
    from?: ReturnType<typeof vi.fn>;
    getUser?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    functions: {
      invoke: overrides.invoke ?? vi.fn(),
    },
    from: overrides.from ?? vi.fn(),
    auth: {
      getUser: overrides.getUser ?? vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  } as unknown as SupabaseClient;
}

/** Builds a chainable `.from().select().eq().order().range()` mock that resolves with `pages` one call at a time. */
function createRangeChain(pages: Array<{ data: unknown[] | null; error: unknown }>) {
  const range = vi.fn().mockImplementation(() => Promise.resolve(pages.shift() ?? { data: [], error: null }));
  const order = vi.fn().mockReturnValue({ range });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order, range };
}

const PARAMS = {
  campaignId: 'campaign-1',
  turnstileToken: 'token-abc',
  fullName: 'Nguyễn Văn A',
  role: 'Cựu học sinh',
  message: 'Chúc mừng đại hội!',
  imageUrl: 'https://cdn.example.com/submissions/campaign-1/abc.jpg',
};

describe('submission.service', () => {
  it('submits the tribute and returns the new submission id', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { id: 'submission-1' }, error: null });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const result = await service.submitTribute(PARAMS);

    expect(invoke).toHaveBeenCalledWith('submit-tribute', { body: PARAMS });
    expect(result).toEqual({ id: 'submission-1' });
  });

  it('throws a SubmissionServiceError with code CAMPAIGN_FULL when the campaign is full', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.', code: 'CAMPAIGN_FULL' }),
      { status: 409 },
    );
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: response } });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const error = await service.submitTribute(PARAMS).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).code).toBe('CAMPAIGN_FULL');
    expect((error as SubmissionServiceError).message).toBe('Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.');
  });

  it('throws a generic SubmissionServiceError for any other failure', async () => {
    const response = new Response(JSON.stringify({ error: 'Ảnh đại diện không hợp lệ.' }), { status: 400 });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: response } });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const error = await service.submitTribute(PARAMS).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).code).toBeUndefined();
    expect((error as SubmissionServiceError).message).toBe('Ảnh đại diện không hợp lệ.');
  });

  it('falls back to a generic message when the error has no readable body', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error('network error') });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const error = await service.submitTribute(PARAMS).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).message).toBe('Không thể gửi thông điệp. Vui lòng thử lại.');
  });
});

const ROW = {
  id: 'submission-1',
  campaign_id: 'campaign-1',
  full_name: 'Nguyễn Văn A',
  role: 'Cựu học sinh',
  message: 'Chúc mừng đại hội!',
  image_url: 'https://cdn.example.com/submissions/campaign-1/abc.jpg',
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('submission.service.listSubmissionsForCampaign', () => {
  it('lists and maps submissions for a campaign', async () => {
    const chain = createRangeChain([{ data: [ROW], error: null }]);
    const from = vi.fn().mockReturnValue(chain);
    const service = createSubmissionService(createMockSupabaseClient({ from }));

    const result = await service.listSubmissionsForCampaign('campaign-1');

    expect(from).toHaveBeenCalledWith('submissions');
    expect(chain.eq).toHaveBeenCalledWith('campaign_id', 'campaign-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([
      {
        id: 'submission-1',
        campaignId: 'campaign-1',
        fullName: 'Nguyễn Văn A',
        role: 'Cựu học sinh',
        message: 'Chúc mừng đại hội!',
        imageUrl: 'https://cdn.example.com/submissions/campaign-1/abc.jpg',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('pages through more than one page of results', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ ...ROW, id: `submission-${i}` }));
    const chain = createRangeChain([
      { data: fullPage, error: null },
      { data: [ROW], error: null },
    ]);
    const from = vi.fn().mockReturnValue(chain);
    const service = createSubmissionService(createMockSupabaseClient({ from }));

    const result = await service.listSubmissionsForCampaign('campaign-1');

    expect(chain.range).toHaveBeenCalledTimes(2);
    expect(chain.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(chain.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(result).toHaveLength(1001);
  });

  it('throws a SubmissionServiceError when the query fails', async () => {
    const chain = createRangeChain([{ data: null, error: new Error('boom') }]);
    const from = vi.fn().mockReturnValue(chain);
    const service = createSubmissionService(createMockSupabaseClient({ from }));

    const error = await service.listSubmissionsForCampaign('campaign-1').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).message).toBe('Không thể tải danh sách thông điệp. Vui lòng thử lại.');
  });

  it('throws a session-expired SubmissionServiceError instead of querying when there is no user', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    const from = vi.fn();
    const service = createSubmissionService(createMockSupabaseClient({ from, getUser }));

    const error = await service.listSubmissionsForCampaign('campaign-1').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).message).toBe('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    expect(from).not.toHaveBeenCalled();
  });
});

describe('submission.service.deleteSubmission', () => {
  it('invokes delete-submission and returns the deleted id', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { id: 'submission-1' }, error: null });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const result = await service.deleteSubmission('submission-1');

    expect(invoke).toHaveBeenCalledWith('delete-submission', { body: { submissionId: 'submission-1' } });
    expect(result).toEqual({ id: 'submission-1' });
  });

  it('throws a SubmissionServiceError with the server message on failure', async () => {
    const response = new Response(JSON.stringify({ error: 'Không tìm thấy thông điệp này.' }), { status: 404 });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { context: response } });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const error = await service.deleteSubmission('submission-1').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).message).toBe('Không tìm thấy thông điệp này.');
  });

  it('falls back to a generic message when the error has no readable body', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error('network error') });
    const service = createSubmissionService(createMockSupabaseClient({ invoke }));

    const error = await service.deleteSubmission('submission-1').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(SubmissionServiceError);
    expect((error as SubmissionServiceError).message).toBe('Không thể xoá thông điệp. Vui lòng thử lại.');
  });
});
