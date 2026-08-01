import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { CampaignPublicPage } from "./CampaignPublicPage";
import type { Campaign } from "../../services/campaign.service";

const {
  mockUploadSubmissionImage,
  mockSubmitTribute,
  mockReportSubmissionError,
  mockCompositeFrameToBlob,
} = vi.hoisted(() => ({
  mockUploadSubmissionImage: vi.fn(),
  mockSubmitTribute: vi.fn(),
  mockReportSubmissionError: vi.fn(),
  mockCompositeFrameToBlob: vi.fn(),
}));

vi.mock("../../queries/submission.queries", () => ({
  uploadSubmissionImageMutationOptions: () => ({
    mutationFn: mockUploadSubmissionImage,
  }),
  submitTributeMutationOptions: () => ({ mutationFn: mockSubmitTribute }),
}));

vi.mock("../../utils/report-submission-error", () => ({
  reportSubmissionError: mockReportSubmissionError,
}));

vi.mock("../../services/frameCompositor.service", () => ({
  compositeFrameToBlob: mockCompositeFrameToBlob,
}));

// TributeForm has its own dedicated tests (field validation, Turnstile
// reset-on-failure) — this page's tests only need to exercise the
// composite -> upload -> submit orchestration around it, so a minimal
// stand-in that calls `onSubmit` with a fixed payload is enough here.
vi.mock("../../components/public/TributeForm", () => ({
  TributeForm: ({
    onSubmit,
  }: {
    onSubmit: (values: unknown) => Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          fullName: "Nguyễn Văn A",
          role: "Cựu học sinh",
          message: "Chúc mừng đại hội!",
          avatar: {
            file: new File(["avatar"], "avatar.jpg", { type: "image/jpeg" }),
          },
          turnstileToken: "turnstile-token",
        }).catch(() => undefined)
      }
    >
      submit-tribute-form
    </button>
  ),
}));

const APPROVED_CAMPAIGN = {
  id: "campaign-1",
  ownerId: "user-1",
  slug: "dai-hoi-ben-tre",
  templateId: null,
  layout: {
    canvas: { width: 1500, height: 843 },
    avatarBox: {
      top: 335,
      left: 200,
      width: 286,
      height: 260,
      shape: "circle" as const,
    },
    nameBox: {
      top: 605,
      left: 159,
      width: 389,
      height: 40,
      shrinkAt: 29,
      textColor: "#ffffff",
    },
    roleBox: {
      top: 650,
      left: 157,
      width: 389,
      height: 45,
      shrinkAt: 20,
      textColor: "#ffffff",
    },
    messageBox: {
      top: 358,
      left: 506,
      width: 801,
      height: 229,
      textColor: "#000",
    },
  },
  backgroundImageUrl:
    "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
  musicUrl: null,
  visibility: "private" as const,
  status: "approved" as const,
  submissionCount: 0,
  createdAt: "2026-07-18T00:00:00.000Z",
  title: null,
  description: null,
  thumbnailUrl: null,
  headerImageUrl: null,
};

const COMPOSITED_BLOB = new Blob(["composited"], { type: "image/jpeg" });

async function renderWithCampaign(campaign: Campaign | null) {
  return await renderWithProviders(<CampaignPublicPage campaign={campaign} />);
}

describe("CampaignPublicPage", () => {
  beforeEach(() => {
    mockUploadSubmissionImage.mockReset();
    mockSubmitTribute.mockReset();
    mockReportSubmissionError.mockClear();
    mockCompositeFrameToBlob.mockReset();
    mockCompositeFrameToBlob.mockResolvedValue(COMPOSITED_BLOB);
  });

  it("shows the not-found page, with no campaign content, when the campaign is null (pending/rejected/suspended/nonexistent — RLS makes these indistinguishable)", async () => {
    await renderWithCampaign(null);

    await screen.findByText("404");
    expect(screen.queryByAltText("Hiện đại")).toBeNull();
  });

  it("renders the campaign template + background for an approved campaign, even with no submission content", async () => {
    const { container } = await renderWithCampaign(APPROVED_CAMPAIGN);

    await screen.findByText("submit-tribute-form");
    const backgroundImg = container.querySelector(
      `img[src="${APPROVED_CAMPAIGN.backgroundImageUrl}"]`,
    );
    expect(backgroundImg).toBeTruthy();
  });

  it("doesn't render a header banner when the campaign has no header image set", async () => {
    const { container } = await renderWithCampaign(APPROVED_CAMPAIGN);

    await screen.findByText("submit-tribute-form");
    // "h-auto" is only ever applied to the header banner <img> (see the
    // natural-aspect-ratio test below) — its absence means the block didn't render.
    expect(container.querySelector("img.h-auto")).toBeNull();
  });

  it("renders the header image at its natural aspect ratio (no fixed aspect wrapper) when set", async () => {
    const { container } = await renderWithCampaign({
      ...APPROVED_CAMPAIGN,
      headerImageUrl: "https://cdn.example.com/header.jpg",
    });

    await screen.findByText("submit-tribute-form");
    const headerImg = container.querySelector(
      `img[src="https://cdn.example.com/header.jpg"]`,
    );
    expect(headerImg).toBeTruthy();
    expect(headerImg?.className).toContain("h-auto");
    expect(headerImg?.className).not.toContain("aspect-");
  });

  it('shows a "campaign full" notice instead of the form when the submission cap has been reached', async () => {
    await renderWithCampaign({
      ...APPROVED_CAMPAIGN,
      submissionCount: 20000,
    });

    await screen.findByText("Chiến dịch đã đủ số lượng gửi");
    expect(screen.queryByText("submit-tribute-form")).toBeNull();
  });

  it("composites the frame first, uploads only the composited image (never the raw avatar), submits the tribute, and shows the download view", async () => {
    mockUploadSubmissionImage.mockResolvedValue(
      "https://cdn.example.com/submissions/campaign-1/abc.jpg",
    );
    mockSubmitTribute.mockResolvedValue({ id: "submission-1" });
    await renderWithCampaign(APPROVED_CAMPAIGN);

    await screen.findByText("submit-tribute-form");
    fireEvent.click(screen.getByText("submit-tribute-form"));

    await waitFor(() => expect(mockCompositeFrameToBlob).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockUploadSubmissionImage).toHaveBeenCalledWith(
        { campaignId: "campaign-1", image: COMPOSITED_BLOB },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockSubmitTribute).toHaveBeenCalledWith(
        {
          campaignId: "campaign-1",
          turnstileToken: "turnstile-token",
          fullName: "Nguyễn Văn A",
          role: "Cựu học sinh",
          message: "Chúc mừng đại hội!",
          imageUrl: "https://cdn.example.com/submissions/campaign-1/abc.jpg",
        },
        expect.anything(),
      ),
    );

    const downloadLink = await screen.findByText("Tải ảnh về máy");
    expect(downloadLink.closest("a")?.getAttribute("href")).toMatch(/^blob:/);
  });

  it("reports a friendly error and never calls upload/submit when compositing itself fails", async () => {
    const failure = new Error("rasterization failed");
    mockCompositeFrameToBlob.mockRejectedValue(failure);
    await renderWithCampaign(APPROVED_CAMPAIGN);

    await screen.findByText("submit-tribute-form");
    fireEvent.click(screen.getByText("submit-tribute-form"));

    await waitFor(() =>
      expect(mockReportSubmissionError).toHaveBeenCalledWith(
        failure,
        "Không thể gửi thông điệp. Vui lòng thử lại.",
      ),
    );
    expect(mockUploadSubmissionImage).not.toHaveBeenCalled();
    expect(mockSubmitTribute).not.toHaveBeenCalled();
    expect(screen.getByText("submit-tribute-form")).toBeTruthy();
  });

  it('shows the "campaign full" notice when submit-tribute rejects with CAMPAIGN_FULL', async () => {
    const { SubmissionServiceError } =
      await import("../../services/submission.service");
    mockUploadSubmissionImage.mockResolvedValue(
      "https://cdn.example.com/submissions/campaign-1/abc.jpg",
    );
    mockSubmitTribute.mockRejectedValue(
      new SubmissionServiceError(
        "Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.",
        { code: "CAMPAIGN_FULL" },
      ),
    );
    await renderWithCampaign(APPROVED_CAMPAIGN);

    await screen.findByText("submit-tribute-form");
    fireEvent.click(screen.getByText("submit-tribute-form"));

    await screen.findByText("Chiến dịch đã đủ số lượng gửi");
    expect(mockReportSubmissionError).not.toHaveBeenCalled();
  });

  it("reports a friendly error for any other submission failure and stays on the form", async () => {
    const failure = new Error("network error");
    mockUploadSubmissionImage.mockRejectedValue(failure);
    await renderWithCampaign(APPROVED_CAMPAIGN);

    await screen.findByText("submit-tribute-form");
    fireEvent.click(screen.getByText("submit-tribute-form"));

    await waitFor(() =>
      expect(mockReportSubmissionError).toHaveBeenCalledWith(
        failure,
        "Không thể gửi thông điệp. Vui lòng thử lại.",
      ),
    );
    expect(screen.getByText("submit-tribute-form")).toBeTruthy();
  });
});
