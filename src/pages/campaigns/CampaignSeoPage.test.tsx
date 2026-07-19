import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { CampaignSeoPage } from './CampaignSeoPage';

const {
  mockUseAuthSession,
  mockListCampaignsForOwner,
  mockUpdateCampaignSeo,
  mockUploadCampaignBackground,
  mockNavigate,
  mockReportCampaignError,
} = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockListCampaignsForOwner: vi.fn(),
  mockUpdateCampaignSeo: vi.fn(),
  mockUploadCampaignBackground: vi.fn(),
  mockNavigate: vi.fn(),
  mockReportCampaignError: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock('../../queries/campaign.queries', () => ({
  campaignKeys: { list: () => ['campaigns', 'list'] },
  campaignsQueryOptions: () => ({ queryKey: ['campaigns', 'list'], queryFn: mockListCampaignsForOwner }),
  campaignBySlugQueryOptions: (slug: string) => ({ queryKey: ['campaigns', 'by-slug', slug] }),
  updateCampaignSeoMutationOptions: () => ({ mutationFn: mockUpdateCampaignSeo }),
  uploadCampaignBackgroundMutationOptions: () => ({ mutationFn: mockUploadCampaignBackground }),
}));

vi.mock('../../utils/report-campaign-error', () => ({
  reportCampaignError: mockReportCampaignError,
}));

const CAMPAIGN = {
  id: 'campaign-1',
  ownerId: 'user-1',
  slug: 'dai-hoi-ben-tre',
  templateId: null,
  layout: { canvas: { width: 1500, height: 843 } },
  backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
  musicUrl: null,
  visibility: 'private' as const,
  status: 'approved' as const,
  submissionCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
  title: null,
  description: null,
  thumbnailUrl: null,
};

function renderAtId(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/campaigns/:id/seo" element={<CampaignSeoPage />} />
      <Route path="/login" element={<div>login-page-placeholder</div>} />
    </Routes>,
    { route: `/campaigns/${id}/seo` },
  );
}

describe('CampaignSeoPage', () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockListCampaignsForOwner.mockReset();
    mockUpdateCampaignSeo.mockReset();
    mockUploadCampaignBackground.mockReset();
    mockNavigate.mockClear();
    mockReportCampaignError.mockClear();
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
  });

  it('redirects to /login when there is no session', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    renderAtId('campaign-1');

    expect(screen.getByText('login-page-placeholder')).toBeTruthy();
  });

  it('shows an error when no campaign with that id belongs to the owner', async () => {
    mockListCampaignsForOwner.mockResolvedValue([]);
    renderAtId('unknown-id');

    expect(await screen.findByText('Không tìm thấy chiến dịch này.')).toBeTruthy();
  });

  it('seeds the form from the campaign existing title/description', async () => {
    mockListCampaignsForOwner.mockResolvedValue([
      { ...CAMPAIGN, title: 'Đại hội Bến Tre', description: 'Mô tả hiện tại.' },
    ]);
    renderAtId('campaign-1');

    expect(await screen.findByDisplayValue('Đại hội Bến Tre')).toBeTruthy();
    expect(screen.getByDisplayValue('Mô tả hiện tại.')).toBeTruthy();
  });

  it('saves title/description (no new thumbnail) and navigates to /campaigns', async () => {
    mockUpdateCampaignSeo.mockResolvedValue(CAMPAIGN);
    renderAtId('campaign-1');

    await screen.findByText('/dai-hoi-ben-tre');
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Đại hội Bến Tre' } });
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Gửi lời chúc mừng của bạn.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(mockUpdateCampaignSeo).toHaveBeenCalledWith(
        {
          campaignId: 'campaign-1',
          seo: { title: 'Đại hội Bến Tre', description: 'Gửi lời chúc mừng của bạn.', thumbnailUrl: null },
        },
        expect.anything(),
      ),
    );
    expect(mockUploadCampaignBackground).not.toHaveBeenCalled();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/campaigns'));
  });

  it('uploads a new thumbnail before saving when one is chosen', async () => {
    mockUploadCampaignBackground.mockResolvedValue('https://cdn.example.com/new-thumb.jpg');
    mockUpdateCampaignSeo.mockResolvedValue(CAMPAIGN);
    renderAtId('campaign-1');

    await screen.findByText('/dai-hoi-ben-tre');
    const file = new File(['thumb'], 'thumb.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    // The preview swapping to a blob: URL is the first observable sign the
    // component's `thumbnailFile` state actually updated — waiting for it
    // here avoids clicking Save before that commits.
    await waitFor(() => expect(document.querySelector('img')?.getAttribute('src')).toBe('blob:mock-object-url'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(mockUploadCampaignBackground).toHaveBeenCalledWith(file, expect.anything()));
    await waitFor(() =>
      expect(mockUpdateCampaignSeo).toHaveBeenCalledWith(
        expect.objectContaining({
          seo: expect.objectContaining({ thumbnailUrl: 'https://cdn.example.com/new-thumb.jpg' }),
        }),
        expect.anything(),
      ),
    );
  });

  it('reports a friendly error and stays on the page when saving fails', async () => {
    const failure = new Error('network error');
    mockUpdateCampaignSeo.mockRejectedValue(failure);
    renderAtId('campaign-1');

    await screen.findByText('/dai-hoi-ben-tre');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(mockReportCampaignError).toHaveBeenCalledWith(failure, 'Không thể lưu thông tin SEO. Vui lòng thử lại.'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
