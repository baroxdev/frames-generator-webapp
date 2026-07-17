import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { CampaignsPage } from './CampaignsPage';

const { mockUseAuthSession, mockListCampaignsForOwner } = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockListCampaignsForOwner: vi.fn(),
}));

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock('../../queries/campaign.queries', () => ({
  campaignsQueryOptions: () => ({ queryKey: ['campaigns', 'list'], queryFn: mockListCampaignsForOwner }),
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
});
