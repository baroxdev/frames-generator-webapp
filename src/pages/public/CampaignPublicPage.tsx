import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConfigErrorNotice } from '../../components/auth/ConfigErrorNotice';
import PrintArea from '../../components/PrintArea';
import { TributeForm, type TributeSubmitValues } from '../../components/public/TributeForm';
import { TributeResult } from '../../components/public/TributeResult';
import { useEnv } from '../../config/useEnv';
import { campaignBySlugQueryOptions } from '../../queries/campaign.queries';
import { submitTributeMutationOptions, uploadSubmissionAvatarMutationOptions } from '../../queries/submission.queries';
import { compositeFrameToDataUrl } from '../../services/frameCompositor.service';
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
 * form: on a successful submission, the blank template preview is replaced
 * by the visitor's actual composited frame with a download action.
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
  const [compositeError, setCompositeError] = useState(false);
  const [compositeAttempt, setCompositeAttempt] = useState(0);
  const [campaignFull, setCampaignFull] = useState(false);
  // Compositing needs a real, unscaled PrintArea instance to rasterize —
  // separate from the scaled on-screen preview below, mirroring how
  // App.tsx's off-screen `cardRef` node was always distinct from any
  // display-only preview.
  const compositeRef = useRef<HTMLDivElement>(null);

  const uploadAvatarMutation = useMutation(uploadSubmissionAvatarMutationOptions());
  const submitTributeMutation = useMutation(submitTributeMutationOptions());

  const campaign = query.data;
  const template = campaign ? getTemplateById(campaign.templateId) : undefined;

  useEffect(() => {
    if (!submittedContent?.avatar) return;
    const avatarObjectUrl = submittedContent.avatar;
    return () => URL.revokeObjectURL(avatarObjectUrl);
  }, [submittedContent]);

  useEffect(() => {
    if (!submittedContent || !template || !compositeRef.current) return;
    let cancelled = false;
    setCompositeError(false);
    compositeFrameToDataUrl(compositeRef.current, template.canvas.width)
      .then((dataUrl) => {
        if (!cancelled) setResultImage(dataUrl);
      })
      .catch(() => {
        // The submission itself already succeeded server-side by this point
        // — only local preview rasterization failed (e.g. a font/canvas
        // issue) — so this must surface as a recoverable state, not leave
        // the visitor stuck with no feedback at all.
        if (!cancelled) setCompositeError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [submittedContent, template, compositeAttempt]);

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
    try {
      const avatarUrl = await uploadAvatarMutation.mutateAsync({ campaignId: campaign.id, file: values.avatarFile });
      await submitTributeMutation.mutateAsync({
        campaignId: campaign.id,
        turnstileToken: values.turnstileToken,
        fullName: values.fullName,
        role: values.role,
        message: values.message,
        avatarUrl,
      });
      setSubmittedContent({
        avatar: URL.createObjectURL(values.avatarFile),
        fullName: values.fullName,
        role: values.role,
        message: values.message,
      });
    } catch (error) {
      if (error instanceof SubmissionServiceError && error.code === 'CAMPAIGN_FULL') {
        setCampaignFull(true);
      } else {
        reportSubmissionError(error, 'Không thể gửi thông điệp. Vui lòng thử lại.');
      }
      throw error;
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
          <TributeResult imageDataUrl={resultImage} />
        ) : compositeError ? (
          <Alert
            type="warning"
            showIcon
            title="Đã gửi thành công"
            description="Thông điệp của bạn đã được ghi nhận, nhưng không thể tạo ảnh xem trước lúc này."
            action={
              <Button size="small" onClick={() => setCompositeAttempt((attempt) => attempt + 1)}>
                Thử lại
              </Button>
            }
          />
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
            isSubmitting={uploadAvatarMutation.isPending || submitTributeMutation.isPending}
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
