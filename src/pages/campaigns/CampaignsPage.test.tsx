import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { CampaignsPage } from './CampaignsPage';

const { mockUseAuthSession, mockListCampaignsForOwner, mockLoadFacebookSdk } = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockListCampaignsForOwner: vi.fn(),
  mockLoadFacebookSdk: vi.fn(),
}));

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock('../../queries/campaign.queries', () => ({
  campaignsQueryOptions: () => ({ queryKey: ['campaigns', 'list'], queryFn: mockListCampaignsForOwner }),
}));

vi.mock('../../lib/facebookSdk', () => ({
  loadFacebookSdk: mockLoadFacebookSdk,
}));

const CAMPAIGN = {
  id: 'campaign-1',
  ownerId: 'user-1',
  slug: 'dai-hoi-ben-tre',
  templateId: 'modern-portrait',
  backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
  musicUrl: null,
  visibility: 'private' as const,
  status: 'pending' as const,
  submissionCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
};

describe('CampaignsPage', () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockListCampaignsForOwner.mockReset();
    mockLoadFacebookSdk.mockReset();
    mockLoadFacebookSdk.mockResolvedValue({ init: vi.fn(), ui: vi.fn() });
    delete (window as { FB?: unknown }).FB;
  });

  it('shows a loading state while the session resolves', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: true, error: null });
    renderWithProviders(<CampaignsPage />);

    expect(screen.getByText('Đang tải...')).toBeTruthy();
  });

  it('redirects to /login when there is no session', async () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    const { Route, Routes } = await import('react-router-dom');
    renderWithProviders(
      <Routes>
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/login" element={<div>login-page-placeholder</div>} />
      </Routes>,
      { route: '/campaigns' },
    );

    expect(screen.getByText('login-page-placeholder')).toBeTruthy();
  });

  it('shows an empty state when the owner has no campaigns', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([]);
    renderWithProviders(<CampaignsPage />);

    expect(await screen.findByText('Bạn chưa có chiến dịch nào.')).toBeTruthy();
  });

  it('lists the owner campaigns with their status', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    renderWithProviders(<CampaignsPage />);

    expect(await screen.findByText('/dai-hoi-ben-tre')).toBeTruthy();
    expect(screen.getByText('Đang chờ duyệt')).toBeTruthy();
  });

  it('renders the slug as a link to the public page that opens in a new tab', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    renderWithProviders(<CampaignsPage />);

    const link = await screen.findByRole('link', { name: /dai-hoi-ben-tre/ });
    expect(link.getAttribute('href')).toBe('/dai-hoi-ben-tre');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('does not show a Facebook share button for a campaign that is not approved yet', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    renderWithProviders(<CampaignsPage />);

    await screen.findByText('/dai-hoi-ben-tre');
    expect(screen.queryByLabelText('Chia sẻ lên Facebook')).toBeNull();
  });

  it('preloads the Facebook SDK on mount so a later share click can call FB.ui synchronously', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    renderWithProviders(<CampaignsPage />);

    await screen.findByText('/dai-hoi-ben-tre');
    expect(mockLoadFacebookSdk).toHaveBeenCalledWith(expect.any(String));
  });

  it('opens the Facebook Share Dialog via FB.ui when window.FB is already warm', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([{ ...CAMPAIGN, status: 'approved' as const }]);
    const ui = vi.fn();
    window.FB = { init: vi.fn(), ui };
    renderWithProviders(<CampaignsPage />);

    fireEvent.click(await screen.findByLabelText('Chia sẻ lên Facebook'));

    expect(ui).toHaveBeenCalledWith(
      { method: 'share', href: `${window.location.origin}/dai-hoi-ben-tre` },
      expect.any(Function),
    );
  });

  it('falls back to loading the SDK before sharing when window.FB is not ready yet', async () => {
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
    mockListCampaignsForOwner.mockResolvedValue([{ ...CAMPAIGN, status: 'approved' as const }]);
    const ui = vi.fn();
    mockLoadFacebookSdk.mockResolvedValue({ init: vi.fn(), ui });
    renderWithProviders(<CampaignsPage />);

    fireEvent.click(await screen.findByLabelText('Chia sẻ lên Facebook'));

    await waitFor(() =>
      expect(ui).toHaveBeenCalledWith(
        { method: 'share', href: `${window.location.origin}/dai-hoi-ben-tre` },
        expect.any(Function),
      ),
    );
  });
});
