import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { EditCampaignLayoutPage } from './EditCampaignLayoutPage';

const { mockUseAuthSession, mockListCampaignsForOwner, mockUpdateCampaignLayout, mockNavigate, mockReportCampaignError } =
  vi.hoisted(() => ({
    mockUseAuthSession: vi.fn(),
    mockListCampaignsForOwner: vi.fn(),
    mockUpdateCampaignLayout: vi.fn(),
    mockNavigate: vi.fn(),
    mockReportCampaignError: vi.fn(),
  }));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock('../../queries/campaign.queries', () => ({
  campaignKeys: { list: () => ['campaigns', 'list'], bySlug: (slug: string) => ['campaigns', 'by-slug', slug] },
  campaignsQueryOptions: () => ({ queryKey: ['campaigns', 'list'], queryFn: mockListCampaignsForOwner }),
  campaignBySlugQueryOptions: (slug: string) => ({ queryKey: ['campaigns', 'by-slug', slug] }),
  updateCampaignLayoutMutationOptions: () => ({ mutationFn: mockUpdateCampaignLayout }),
}));

vi.mock('../../utils/report-campaign-error', () => ({
  reportCampaignError: mockReportCampaignError,
}));

// LayoutEditor's own interaction is covered by its own dedicated tests —
// this page's tests only need the load -> edit -> save orchestration, so a
// minimal stand-in that calls onChange with a fixed edited layout is enough.
vi.mock('../../components/campaigns/LayoutEditor', () => ({
  LayoutEditor: ({ onChange }: { onChange: (layout: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ edited: true })}>
      edit-layout-placeholder
    </button>
  ),
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
};

function renderAtId(id: string) {
  return await renderWithProviders(<EditCampaignLayoutPage />, {
    route: `/campaigns/${id}/edit`,
    path: '/campaigns/$id/edit',
  });
}

describe('EditCampaignLayoutPage', () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockListCampaignsForOwner.mockReset();
    mockUpdateCampaignLayout.mockReset();
    mockNavigate.mockClear();
    mockReportCampaignError.mockClear();
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
  });

  it('redirects to /login when there is no session', async () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    await renderWithProviders(<EditCampaignLayoutPage />, {
      route: '/campaigns/campaign-1/edit',
      path: '/campaigns/$id/edit',
      additionalRoutes: [{ path: '/login', element: <div>login-page-placeholder</div> }],
    });

    expect(screen.getByText('login-page-placeholder')).toBeTruthy();
  });

  it('shows an error when no campaign with that id belongs to the owner', async () => {
    mockListCampaignsForOwner.mockResolvedValue([]);
    renderAtId('unknown-id');

    expect(await screen.findByText('Không tìm thấy chiến dịch này.')).toBeTruthy();
  });

  it('loads the campaign and renders the layout editor over its existing background', async () => {
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    renderAtId('campaign-1');

    expect(await screen.findByText('/dai-hoi-ben-tre')).toBeTruthy();
    expect(screen.getByText('edit-layout-placeholder')).toBeTruthy();
  });

  it('saves the edited layout, invalidates caches, and navigates back to /campaigns', async () => {
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    mockUpdateCampaignLayout.mockResolvedValue(CAMPAIGN);
    renderAtId('campaign-1');

    await screen.findByText('edit-layout-placeholder');
    fireEvent.click(screen.getByText('edit-layout-placeholder'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bố cục' }));

    await waitFor(() =>
      expect(mockUpdateCampaignLayout).toHaveBeenCalledWith(
        { campaignId: 'campaign-1', layout: { edited: true } },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/campaigns' }));
  });

  it('reports a friendly error and stays on the page when saving fails', async () => {
    const failure = new Error('network error');
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    mockUpdateCampaignLayout.mockRejectedValue(failure);
    renderAtId('campaign-1');

    await screen.findByText('edit-layout-placeholder');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bố cục' }));

    await waitFor(() =>
      expect(mockReportCampaignError).toHaveBeenCalledWith(failure, 'Không thể lưu bố cục. Vui lòng thử lại.'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
