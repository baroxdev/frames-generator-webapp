import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { CampaignPublicPage } from './CampaignPublicPage';

const { mockGetCampaignBySlug } = vi.hoisted(() => ({ mockGetCampaignBySlug: vi.fn() }));

vi.mock('../../queries/campaign.queries', () => ({
  campaignBySlugQueryOptions: (slug: string) => ({
    queryKey: ['campaigns', 'by-slug', slug],
    queryFn: () => mockGetCampaignBySlug(slug),
  }),
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
});
