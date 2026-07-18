import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { SubmissionServiceError, createSubmissionService } from './submission.service';

function createMockSupabaseClient(overrides: { invoke?: ReturnType<typeof vi.fn> } = {}) {
  return {
    functions: {
      invoke: overrides.invoke ?? vi.fn(),
    },
  } as unknown as SupabaseClient;
}

const PARAMS = {
  campaignId: 'campaign-1',
  turnstileToken: 'token-abc',
  fullName: 'Nguyễn Văn A',
  role: 'Cựu học sinh',
  message: 'Chúc mừng đại hội!',
  avatarUrl: 'https://cdn.example.com/submissions/campaign-1/abc.jpg',
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
