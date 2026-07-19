import { describe, expect, it } from 'vitest';
import type { Campaign } from '../services/campaign.service';
import { resolveCampaignSeo } from './resolveCampaignSeo';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'campaign-1',
    ownerId: 'user-1',
    slug: 'dai-hoi-ben-tre',
    templateId: null,
    layout: {} as Campaign['layout'],
    backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
    musicUrl: null,
    visibility: 'private',
    status: 'approved',
    submissionCount: 0,
    createdAt: '2026-07-18T00:00:00.000Z',
    title: null,
    description: null,
    thumbnailUrl: null,
    ...overrides,
  };
}

describe('resolveCampaignSeo', () => {
  it('falls back to the slug, a generic description, and the background image when nothing is set', () => {
    const result = resolveCampaignSeo(makeCampaign());

    expect(result).toEqual({
      title: '/dai-hoi-ben-tre',
      description: 'Xem và gửi lời chúc mừng của bạn.',
      thumbnailUrl: 'https://cdn.example.com/bg.jpg',
    });
  });

  it('uses the owner-set values when present', () => {
    const result = resolveCampaignSeo(
      makeCampaign({
        title: 'Đại hội Bến Tre',
        description: 'Gửi lời chúc mừng đến đại hội!',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      }),
    );

    expect(result).toEqual({
      title: 'Đại hội Bến Tre',
      description: 'Gửi lời chúc mừng đến đại hội!',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    });
  });

  it('treats a whitespace-only title/description as unset', () => {
    const result = resolveCampaignSeo(makeCampaign({ title: '   ', description: '  ' }));

    expect(result.title).toBe('/dai-hoi-ben-tre');
    expect(result.description).toBe('Xem và gửi lời chúc mừng của bạn.');
  });
});
