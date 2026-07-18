import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button } from "antd";
import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useParams } from "react-router-dom";
import { ConfigErrorNotice } from "../../components/auth/ConfigErrorNotice";
import PrintArea from "../../components/PrintArea";
import {
  TributeForm,
  type TributeSubmitValues,
} from "../../components/public/TributeForm";
import { useEnv } from "../../config/useEnv";
import { campaignBySlugQueryOptions } from "../../queries/campaign.queries";
import {
  submitTributeMutationOptions,
  uploadSubmissionImageMutationOptions,
} from "../../queries/submission.queries";
import { compositeFrameToBlob } from "../../services/frameCompositor.service";
import { SubmissionServiceError } from "../../services/submission.service";
import { campaignLayoutToTemplate } from "../../templates";
import type { CampaignLayout, FrameContent } from "../../templates/types";
import { reportSubmissionError } from "../../utils/report-submission-error";
import { NotFoundPage } from "./NotFoundPage";
import { useForm, UseFormReturn, useWatch } from "react-hook-form";
import { Campaign } from "../../services/campaign.service";
import { DownloadOutlined } from "@ant-design/icons";

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
  const query = useQuery({
    ...campaignBySlugQueryOptions(slug ?? ""),
    enabled: Boolean(slug),
  });
  const form = useForm<TributeSubmitValues>({
    defaultValues: {
      fullName: "",
      role: "",
      message: "",
      avatar: {
        file: null,
      },
      turnstileToken: "",
    },
    mode: "onChange",
  });
  const [submittedContent, setSubmittedContent] = useState<FrameContent | null>(
    null,
  );
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

  const uploadImageMutation = useMutation(
    uploadSubmissionImageMutationOptions(),
  );
  const submitTributeMutation = useMutation(submitTributeMutationOptions());

  const campaign = query.data;

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

  if (!campaign) {
    return <NotFoundPage />;
  }

  const isFull = campaignFull || campaign.submissionCount >= SUBMISSION_CAP;

  const handleSubmit = async (values: TributeSubmitValues) => {
    const avatarFile = values.avatar.file;
    if (!avatarFile) {
      throw new Error("Missing avatar file");
    }

    const avatarObjectUrl = URL.createObjectURL(avatarFile);
    // Render the off-screen PrintArea with the submitted content and force
    // React to commit it synchronously — compositing right after needs the
    // DOM node to already reflect these values, and a plain `setState`
    // wouldn't be flushed yet at this point in an event handler.
    flushSync(() => {
      setSubmittedContent({
        avatar: avatarObjectUrl,
        fullName: values.fullName,
        role: values.role,
        message: values.message,
      });
    });
    setIsCompositing(true);

    try {
      if (!compositeRef.current) {
        throw new Error("Compositor node did not mount");
      }
      // Composite first, before any network call: it's local and free, so a
      // failure here (e.g. a font/rendering issue) is caught before
      // spending the single-use Turnstile token or any R2/DB round-trip.
      const imageBlob = await compositeFrameToBlob(compositeRef.current);
      const imageUrl = await uploadImageMutation.mutateAsync({
        campaignId: campaign.id,
        image: imageBlob,
      });
      await submitTributeMutation.mutateAsync({
        campaignId: campaign.id,
        turnstileToken: values.turnstileToken ?? "",
        fullName: values.fullName,
        role: values.role,
        message: values.message,
        imageUrl,
      });
      setResultImage(imageUrl);
    } catch (error) {
      // The avatar object URL is revoked by the cleanup effect above once
      // `submittedContent` changes — no need to revoke it again here.
      setSubmittedContent(null);
      if (
        error instanceof SubmissionServiceError &&
        error.code === "CAMPAIGN_FULL"
      ) {
        setCampaignFull(true);
      } else {
        reportSubmissionError(
          error,
          "Không thể gửi thông điệp. Vui lòng thử lại.",
        );
      }
      throw error;
    } finally {
      setIsCompositing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="relative mx-auto w-full max-w-4xl">
        <Previewer
          campaign={campaign}
          submittedContent={submittedContent}
          form={form}
        />
        {/* {resultImage && ( */}
        <a
          href={"https://placehold.co/150x150?text=Avatar"}
          download="anh.jpg"
          onClick={(e) => {
            e.preventDefault();
            if (resultImage) {
              const link = document.createElement("a");
              link.href = resultImage;
              link.download = "khung-anh-tri-an.jpg";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
          className="absolute bottom-3 right-1/2 transform translate-x-1/2"
        >
          <Button type="primary" icon={<DownloadOutlined />} className="mt-6">
            Tải ảnh về máy
          </Button>
        </a>
        {/* )} */}
      </div>

      <div className="mx-auto mt-8 w-full max-w-md">
        {isFull ? (
          <Alert
            type="warning"
            showIcon
            message="Chiến dịch đã đủ số lượng gửi"
            description="Chiến dịch này đã nhận đủ số lượng thông điệp tối đa. Vui lòng thử lại ở một chiến dịch khác."
          />
        ) : envError || !env ? (
          <ConfigErrorNotice message={envError ?? "Thiếu cấu hình."} />
        ) : (
          <TributeForm
            form={form}
            turnstileSiteKey={env.VITE_TURNSTILE_SITE_KEY}
            isSubmitting={
              isCompositing ||
              uploadImageMutation.isPending ||
              submitTributeMutation.isPending
            }
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {submittedContent && !resultImage && (
        <div
          className="fixed left-[-10000px] top-0 pointer-events-none"
          aria-hidden
        >
          <PrintArea
            ref={compositeRef}
            template={campaignLayoutToTemplate(
              campaign.id,
              campaign.backgroundImageUrl,
              campaign.layout,
            )}
            content={submittedContent}
          />
        </div>
      )}
    </div>
  );
}

type PreviewerProps = {
  campaign: Campaign;
  submittedContent: FrameContent | null;
  form: UseFormReturn<TributeSubmitValues>;
};

function Previewer({ campaign, submittedContent, form }: PreviewerProps) {
  const layout: CampaignLayout = campaign.layout;
  const formValues = useWatch(form);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // As soon as the visitor picks/crops an avatar, the live preview should
  // show that actual photo — not the static placeholder — even before they
  // submit. `submittedContent` (below) only exists post-submit, so this is
  // a second, earlier source for the same `avatar` slot; the placeholder
  // stays the fallback for "nothing chosen yet" only.
  const avatarFile = formValues.avatar?.file;
  const [liveAvatarUrl, setLiveAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!avatarFile) {
      setLiveAvatarUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setLiveAvatarUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  React.useEffect(() => {
    const container = containerRef?.current;
    const innerElement = innerRef.current;

    if (!container || !innerElement) return;

    const TARGET_WIDTH = layout.canvas.width; // The original width of the campaign's canvas

    // Create the ResizeObserver to listen to the parent container's width changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize for accuracy, falling back to contentRect
        const containerWidth =
          entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;

        // Formula: scale = current / original
        const scale = containerWidth / TARGET_WIDTH;

        // Apply the styles directly to the DOM for performance
        innerElement.style.transformOrigin = "left top";
        innerElement.style.transform = `scale(${scale})`;
      }
    });

    // Start tracking the parent container
    resizeObserver.observe(container);

    // Clean up the observer when the component unmounts
    return () => {
      resizeObserver.disconnect();
    };
  }, [layout, containerRef]); // Empty dependency array ensures this runs once on mount
  if (!campaign) {
    return null;
  }

  return (
    <div style={{ containerType: "inline-size" }}>
      <div
        className="relative overflow-hidden rounded-lg shadow"
        style={{
          aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}`,
        }}
        ref={containerRef}
      >
        <div
          className="relative"
          style={{
            width: layout.canvas.width,
            height: layout.canvas.height,
            transformOrigin: "top left",
          }}
          ref={innerRef}
        >
          <PrintArea
            template={campaignLayoutToTemplate(
              campaign.id,
              campaign.backgroundImageUrl,
              layout,
            )}
            content={{
              avatar:
                submittedContent?.avatar ??
                liveAvatarUrl ??
                "https://placehold.co/150x150?text=Avatar",
              fullName: formValues.fullName ?? "Họ và tên",
              role: formValues.role ?? "Đơn vị / Chức vụ",
              message: formValues.message ?? "Thông điệp gửi đến đại hội",
            }}
          />
        </div>
      </div>
    </div>
  );
}
