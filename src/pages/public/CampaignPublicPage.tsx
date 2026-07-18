import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'react-router-dom';
import { ConfigErrorNotice } from '../../components/auth/ConfigErrorNotice';
import PrintArea from '../../components/PrintArea';
import { TributeForm, type TributeSubmitValues } from '../../components/public/TributeForm';
import { TributeResult } from '../../components/public/TributeResult';
import { useEnv } from '../../config/useEnv';
import { campaignBySlugQueryOptions } from '../../queries/campaign.queries';
import { submitTributeMutationOptions, uploadSubmissionImageMutationOptions } from '../../queries/submission.queries';
import { compositeFrameToBlob } from '../../services/frameCompositor.service';
import { SubmissionServiceError } from '../../services/submission.service';
import { getTemplateById } from '../../templates';
import type { FrameContent } from '../../templates/types';
import { reportSubmissionError } from '../../utils/report-submission-error';
import { NotFoundPage } from './NotFoundPage';

// Mirrors the `5000` in `create_submission`'s guard
// (supabase/migrations/0003_submissions.sql) — this copy only drives a
// proactive UI check (skip rendering the form when we already know it's
// full); the RPC's own check is the actual, authoritative enforcement.
const SUBMISSION_CAP = 5000;

/**
 * The public landing page for an approved campaign, at /:slug. Renders the
 * campaign's chosen template + uploaded background using the same template
 * engine as the owner's live preview (#3/#4), plus (#6) the visitor tribute
 * form: on submit, the visitor's content is composited into the final frame
 * *before* anything is uploaded — only that final image ever reaches R2,
 * never the visitor's raw avatar photo — and the same image is then shown
 * with an active download link.
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
  const { env, error: envError } = useEnv();
  const query = useQuery({ ...campaignBySlugQueryOptions(slug ?? ''), enabled: Boolean(slug) });

  const [submittedContent, setSubmittedContent] = useState<FrameContent | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [campaignFull, setCampaignFull] = useState(false);
  // Covers the gap between clicking submit and the upload mutation actually
  // starting — compositing itself has no TanStack Query `isPending` of its
  // own to reflect, but the submit button still needs to show busy/disabled
  // for that whole window, not just once the network calls begin.
  const [isCompositing, setIsCompositing] = useState(false);
  // The off-screen PrintArea instance compositing rasterizes — separate
  // from the scaled on-screen preview below, mirroring how App.tsx's
  // off-screen `cardRef` node was always distinct from any display-only
  // preview.
  const compositeRef = useRef<HTMLDivElement>(null);

  const uploadImageMutation = useMutation(uploadSubmissionImageMutationOptions());
  const submitTributeMutation = useMutation(submitTributeMutationOptions());

  const campaign = query.data;
  const template = campaign ? getTemplateById(campaign.templateId) : undefined;

  useEffect(() => {
    if (!submittedContent?.avatar) return;
    const avatarObjectUrl = submittedContent.avatar;
    return () => URL.revokeObjectURL(avatarObjectUrl);
  }, [submittedContent]);

  useEffect(() => {
    if (!resultImage) return;
    return () => URL.revokeObjectURL(resultImage);
  }, [resultImage]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!campaign || !template) {
    return <NotFoundPage />;
  }

  const isFull = campaignFull || campaign.submissionCount >= SUBMISSION_CAP;

  const handleSubmit = async (values: TributeSubmitValues) => {
    const avatarObjectUrl = URL.createObjectURL(values.avatarFile);
    // Render the off-screen PrintArea with the submitted content and force
    // React to commit it synchronously — compositing right after needs the
    // DOM node to already reflect these values, and a plain `setState`
    // wouldn't be flushed yet at this point in an event handler.
    flushSync(() => {
      setSubmittedContent({ avatar: avatarObjectUrl, fullName: values.fullName, role: values.role, message: values.message });
    });
    setIsCompositing(true);

    try {
      if (!compositeRef.current) {
        throw new Error('Compositor node did not mount');
      }
      // Composite first, before any network call: it's local and free, so a
      // failure here (e.g. a font/rendering issue) is caught before
      // spending the single-use Turnstile token or any R2/DB round-trip.
      const imageBlob = await compositeFrameToBlob(compositeRef.current);
      const imageUrl = await uploadImageMutation.mutateAsync({ campaignId: campaign.id, image: imageBlob });
      await submitTributeMutation.mutateAsync({
        campaignId: campaign.id,
        turnstileToken: values.turnstileToken,
        fullName: values.fullName,
        role: values.role,
        message: values.message,
        imageUrl,
      });
      // Already have the exact uploaded bytes locally — no need to composite
      // a second time or round-trip to R2 just to display the result.
      setResultImage(URL.createObjectURL(imageBlob));
    } catch (error) {
      // The avatar object URL is revoked by the cleanup effect above once
      // `submittedContent` changes — no need to revoke it again here.
      setSubmittedContent(null);
      if (error instanceof SubmissionServiceError && error.code === 'CAMPAIGN_FULL') {
        setCampaignFull(true);
      } else {
        reportSubmissionError(error, 'Không thể gửi thông điệp. Vui lòng thử lại.');
      }
      throw error;
    } finally {
      setIsCompositing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      {!resultImage && (
        // `cqw` scales the fixed-pixel template canvas to the container's
        // actual width without any JS measurement (jsdom can't compute real
        // layout, so a ResizeObserver-based approach wouldn't be reliably
        // testable) — the browser recomputes it on resize for free.
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
      )}

      <div className="mx-auto mt-8 w-full max-w-md">
        {resultImage ? (
          <TributeResult imageUrl={resultImage} />
        ) : isFull ? (
          <Alert
            type="warning"
            showIcon
            title="Chiến dịch đã đủ số lượng gửi"
            description="Chiến dịch này đã nhận đủ số lượng thông điệp tối đa. Vui lòng thử lại ở một chiến dịch khác."
          />
        ) : envError || !env ? (
          <ConfigErrorNotice message={envError ?? 'Thiếu cấu hình.'} />
        ) : (
          <TributeForm
            turnstileSiteKey={env.VITE_TURNSTILE_SITE_KEY}
            isSubmitting={isCompositing || uploadImageMutation.isPending || submitTributeMutation.isPending}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {submittedContent && !resultImage && (
        <PrintArea
          ref={compositeRef}
          template={{ ...template, background: campaign.backgroundImageUrl }}
          content={submittedContent}
        />
      )}
    </div>
  );
}
