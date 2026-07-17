import { describe, expect, it } from 'vitest';
import { createCampaignSchema, slugField } from './campaign.schema';

describe('slugField', () => {
  it.each(['dai-hoi-ben-tre', 'abc', 'a1-b2-c3', 'daihoitinhbentre'])('accepts %s', (slug) => {
    expect(slugField.safeParse(slug).success).toBe(true);
  });

  it.each([
    ['ab', 'too short'],
    ['a'.repeat(51), 'too long'],
    ['Dai-Hoi', 'uppercase letters'],
    ['dai_hoi', 'underscore instead of hyphen'],
    ['-dai-hoi', 'leading hyphen'],
    ['dai-hoi-', 'trailing hyphen'],
    ['dai--hoi', 'double hyphen'],
    ['dai hoi', 'space'],
  ])('rejects %s (%s)', (slug) => {
    expect(slugField.safeParse(slug).success).toBe(false);
  });
});

describe('createCampaignSchema', () => {
  it('accepts a valid slug and templateId', () => {
    const result = createCampaignSchema.safeParse({ slug: 'dai-hoi-ben-tre', templateId: 'modern-portrait' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty templateId', () => {
    const result = createCampaignSchema.safeParse({ slug: 'dai-hoi-ben-tre', templateId: '' });
    expect(result.success).toBe(false);
  });
});
