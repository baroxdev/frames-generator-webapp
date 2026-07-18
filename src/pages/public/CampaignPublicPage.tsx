import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import PrintArea from '../../components/PrintArea';
import { campaignBySlugQueryOptions } from '../../queries/campaign.queries';
import { getTemplateById } from '../../templates';
import { NotFoundPage } from './NotFoundPage';

/**
 * The public landing page for an approved campaign, at /:slug. Renders the
 * campaign's chosen template + uploaded background using the same template
 * engine as the owner's live preview (#3/#4), with no submission content
 * yet (#6 adds the actual submission form on top of this page).
 *
 * A pending/rejected/suspended campaign and a slug that was never
 * registered are indistinguishable here on purpose — both resolve to
 * `campaign === null` (RLS silently withholds the row rather than the
 * client trying to tell them apart) and render the same not-found page,
 * per #5's "no campaign content, background, or branding is exposed"
 * requirement.
 */
export function CampaignPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const query = useQuery({ ...campaignBySlugQueryOptions(slug ?? ''), enabled: Boolean(slug) });

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  const campaign = query.data;
  const template = campaign ? getTemplateById(campaign.templateId) : undefined;
  if (!campaign || !template) {
    return <NotFoundPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      {/* `cqw` scales the fixed-pixel template canvas to the container's
          actual width without any JS measurement (jsdom can't compute real
          layout, so a ResizeObserver-based approach wouldn't be reliably
          testable) — the browser recomputes it on resize for free. */}
      <div className="mx-auto w-full max-w-4xl" style={{ containerType: 'inline-size' }}>
        <div
          className="relative overflow-hidden rounded-lg shadow"
          style={{ aspectRatio: `${template.canvas.width} / ${template.canvas.height}` }}
        >
          <div
            className="relative"
            style={{
              width: template.canvas.width,
              height: template.canvas.height,
              transform: `scale(calc(100cqw / ${template.canvas.width}))`,
              transformOrigin: 'top left',
            }}
          >
            <PrintArea
              isDevMod
              template={{ ...template, background: campaign.backgroundImageUrl }}
              content={{}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
