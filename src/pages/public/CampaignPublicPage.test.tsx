import { screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { CampaignPublicPage } from './CampaignPublicPage';

const {
  mockGetCampaignBySlug,
  mockUploadSubmissionAvatar,
  mockSubmitTribute,
  mockReportSubmissionError,
  mockCompositeFrameToDataUrl,
} = vi.hoisted(() => ({
  mockGetCampaignBySlug: vi.fn(),
  mockUploadSubmissionAvatar: vi.fn(),
  mockSubmitTribute: vi.fn(),
  mockReportSubmissionError: vi.fn(),
  mockCompositeFrameToDataUrl: vi.fn(),
}));

vi.mock('../../queries/campaign.queries', () => ({
  campaignBySlugQueryOptions: (slug: string) => ({
    queryKey: ['campaigns', 'by-slug', slug],
    queryFn: () => mockGetCampaignBySlug(slug),
  }),
}));

vi.mock('../../queries/submission.queries', () => ({
  uploadSubmissionAvatarMutationOptions: () => ({ mutationFn: mockUploadSubmissionAvatar }),
  submitTributeMutationOptions: () => ({ mutationFn: mockSubmitTribute }),
}));

vi.mock('../../utils/report-submission-error', () => ({
  reportSubmissionError: mockReportSubmissionError,
}));

vi.mock('../../services/frameCompositor.service', () => ({
  compositeFrameToDataUrl: mockCompositeFrameToDataUrl,
}));

// TributeForm has its own dedicated tests (field validation, Turnstile
// reset-on-failure) — this page's tests only need to exercise the
// upload -> submit -> composite orchestration around it, so a minimal stand-in
// that calls `onSubmit` with a fixed payload is enough here.
vi.mock('../../components/public/TributeForm', () => ({
  TributeForm: ({ onSubmit }: { onSubmit: (values: unknown) => Promise<void> }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          fullName: 'Nguyễn Văn A',
          role: 'Cựu học sinh',
          message: 'Chúc mừng đại hội!',
          avatarFile: new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' }),
          turnstileToken: 'turnstile-token',
        }).catch(() => undefined)
      }
    >
      submit-tribute-form
    </button>
  ),
}));

const APPROVED_CAMPAIGN = {
  id: 'campaign-1',
  ownerId: 'user-1',
  slug: 'dai-hoi-ben-tre',
  templateId: 'modern-portrait',
  backgroundImageUrl: 'https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg',
  musicUrl: null,
  visibility: 'private' as const,
  status: 'approved' as const,
  submissionCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
};

function renderAtSlug(slug: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/:slug" element={<CampaignPublicPage />} />
    </Routes>,
    { route: `/${slug}` },
  );
}

describe('CampaignPublicPage', () => {
  beforeEach(() => {
    mockGetCampaignBySlug.mockReset();
    mockUploadSubmissionAvatar.mockReset();
    mockSubmitTribute.mockReset();
    mockReportSubmissionError.mockClear();
    mockCompositeFrameToDataUrl.mockReset();
    mockCompositeFrameToDataUrl.mockResolvedValue('data:image/jpeg;base64,composited');
  });

  it('shows a loading state while the campaign is being resolved', () => {
    // Never resolves — the assertion below only cares about the loading state.
    mockGetCampaignBySlug.mockReturnValue(new Promise(() => undefined));
    renderAtSlug('dai-hoi-ben-tre');

    expect(screen.getByText('Đang tải...')).toBeTruthy();
  });

  it('shows the not-found page, with no campaign content, when the campaign is null (pending/rejected/suspended/nonexistent — RLS makes these indistinguishable)', async () => {
    mockGetCampaignBySlug.mockResolvedValue(null);
    renderAtSlug('not-approved-or-missing');

    await screen.findByText('404');
    expect(screen.queryByAltText('Hiện đại')).toBeNull();
  });

  it('renders the campaign template + background for an approved campaign, even with no submission content', async () => {
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    const { container } = renderAtSlug('dai-hoi-ben-tre');

    await screen.findByText('Tên của bạn');
    const backgroundImg = container.querySelector(`img[src="${APPROVED_CAMPAIGN.backgroundImageUrl}"]`);
    expect(backgroundImg).toBeTruthy();
  });

  it('shows a "campaign full" notice instead of the form when the submission cap has been reached', async () => {
    mockGetCampaignBySlug.mockResolvedValue({ ...APPROVED_CAMPAIGN, submissionCount: 5000 });
    renderAtSlug('dai-hoi-ben-tre');

    await screen.findByText('Chiến dịch đã đủ số lượng gửi');
    expect(screen.queryByText('submit-tribute-form')).toBeNull();
  });

  it('uploads the avatar, submits the tribute, composites the result, and shows the download view', async () => {
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionAvatar.mockResolvedValue('https://cdn.example.com/submissions/campaign-1/abc.jpg');
    mockSubmitTribute.mockResolvedValue({ id: 'submission-1' });
    renderAtSlug('dai-hoi-ben-tre');

    await screen.findByText('submit-tribute-form');
    fireEvent.click(screen.getByText('submit-tribute-form'));

    await waitFor(() =>
      expect(mockUploadSubmissionAvatar).toHaveBeenCalledWith(
        { campaignId: 'campaign-1', file: expect.any(File) },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockSubmitTribute).toHaveBeenCalledWith(
        {
          campaignId: 'campaign-1',
          turnstileToken: 'turnstile-token',
          fullName: 'Nguyễn Văn A',
          role: 'Cựu học sinh',
          message: 'Chúc mừng đại hội!',
          avatarUrl: 'https://cdn.example.com/submissions/campaign-1/abc.jpg',
        },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(mockCompositeFrameToDataUrl).toHaveBeenCalled());

    const downloadLink = await screen.findByText('Tải ảnh về máy');
    expect(downloadLink.closest('a')?.getAttribute('href')).toBe('data:image/jpeg;base64,composited');
  });

  it('shows a recoverable notice (not a silent dead end) when compositing the result fails, and lets the visitor retry', async () => {
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionAvatar.mockResolvedValue('https://cdn.example.com/submissions/campaign-1/abc.jpg');
    mockSubmitTribute.mockResolvedValue({ id: 'submission-1' });
    mockCompositeFrameToDataUrl.mockRejectedValueOnce(new Error('canvas rasterization failed'));
    renderAtSlug('dai-hoi-ben-tre');

    await screen.findByText('submit-tribute-form');
    fireEvent.click(screen.getByText('submit-tribute-form'));

    await screen.findByText('Đã gửi thành công');
    expect(screen.queryByText('Tải ảnh về máy')).toBeNull();

    fireEvent.click(screen.getByText('Thử lại'));

    const downloadLink = await screen.findByText('Tải ảnh về máy');
    expect(downloadLink.closest('a')?.getAttribute('href')).toBe('data:image/jpeg;base64,composited');
  });

  it('shows the "campaign full" notice when submit-tribute rejects with CAMPAIGN_FULL, without ever compositing', async () => {
    const { SubmissionServiceError } = await import('../../services/submission.service');
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionAvatar.mockResolvedValue('https://cdn.example.com/submissions/campaign-1/abc.jpg');
    mockSubmitTribute.mockRejectedValue(
      new SubmissionServiceError('Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.', { code: 'CAMPAIGN_FULL' }),
    );
    renderAtSlug('dai-hoi-ben-tre');

    await screen.findByText('submit-tribute-form');
    fireEvent.click(screen.getByText('submit-tribute-form'));

    await screen.findByText('Chiến dịch đã đủ số lượng gửi');
    expect(mockCompositeFrameToDataUrl).not.toHaveBeenCalled();
    expect(mockReportSubmissionError).not.toHaveBeenCalled();
  });

  it('reports a friendly error for any other submission failure and stays on the form', async () => {
    const failure = new Error('network error');
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionAvatar.mockRejectedValue(failure);
    renderAtSlug('dai-hoi-ben-tre');

    await screen.findByText('submit-tribute-form');
    fireEvent.click(screen.getByText('submit-tribute-form'));

    await waitFor(() =>
      expect(mockReportSubmissionError).toHaveBeenCalledWith(failure, 'Không thể gửi thông điệp. Vui lòng thử lại.'),
    );
    expect(screen.getByText('submit-tribute-form')).toBeTruthy();
  });
});
