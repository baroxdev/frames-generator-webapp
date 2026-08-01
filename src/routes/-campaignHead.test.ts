import { describe, expect, it } from 'vitest';
import { campaignHead } from './-campaignHead';
import type { Campaign } from '../services/campaign.service';

const BASE_CAMPAIGN: Campaign = {
  id: 'campaign-1',
  ownerId: 'user-1',
  slug: 'dai-hoi-ben-tre',
  templateId: null,
  layout: { canvas: { width: 1500, height: 843 } } as Campaign['layout'],
  backgroundImageUrl: 'https://cdn.example.com/bg.jpg',
  musicUrl: null,
  visibility: 'public',
  status: 'approved',
  submissionCount: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
  title: null,
  description: null,
  thumbnailUrl: null,
  headerImageUrl: null,
};

function findMeta(meta: ReturnType<typeof campaignHead>['meta'], key: 'title' | 'name' | 'property', value?: string) {
  return meta.find((entry) => {
    const record = entry as unknown as Record<string, string | undefined>;
    if (key === 'title') return record.title !== undefined;
    return record[key] === value;
  });
}

describe('campaignHead', () => {
  it('uses the campaign owner-set title/description/thumbnail when present', () => {
    const head = campaignHead({
      ...BASE_CAMPAIGN,
      title: 'Đại hội Bến Tre',
      description: 'Mô tả tuỳ chỉnh.',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    });

    expect(findMeta(head.meta, 'title')).toEqual({ title: 'Đại hội Bến Tre' });
    expect(findMeta(head.meta, 'property', 'og:title')).toMatchObject({ content: 'Đại hội Bến Tre' });
    expect(findMeta(head.meta, 'property', 'og:description')).toMatchObject({ content: 'Mô tả tuỳ chỉnh.' });
    expect(findMeta(head.meta, 'property', 'og:image')).toMatchObject({ content: 'https://cdn.example.com/thumb.jpg' });
    expect(findMeta(head.meta, 'name', 'twitter:card')).toMatchObject({ content: 'summary_large_image' });
  });

  it('falls back to slug/default description/background image when SEO fields are unset', () => {
    const head = campaignHead(BASE_CAMPAIGN);

    expect(findMeta(head.meta, 'title')).toEqual({ title: '/dai-hoi-ben-tre' });
    expect(findMeta(head.meta, 'property', 'og:description')).toMatchObject({
      content: 'Xem và gửi lời chúc mừng của bạn.',
    });
    expect(findMeta(head.meta, 'property', 'og:image')).toMatchObject({ content: 'https://cdn.example.com/bg.jpg' });
  });

  it('shows a generic not-found title/description with no image when the campaign is null', () => {
    const head = campaignHead(null);

    expect(findMeta(head.meta, 'title')).toEqual({ title: 'Không tìm thấy chiến dịch' });
    expect(findMeta(head.meta, 'property', 'og:image')).toBeUndefined();
    expect(findMeta(head.meta, 'name', 'description')).toMatchObject({
      content: 'Đường dẫn này không tồn tại hoặc chiến dịch chưa được duyệt.',
    });
  });
});
