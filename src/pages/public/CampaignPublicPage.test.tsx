import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { CampaignPublicPage } from "./CampaignPublicPage";

const {
  mockGetCampaignBySlug,
  mockUploadSubmissionImage,
  mockSubmitTribute,
  mockReportSubmissionError,
  mockCompositeFrameToBlob,
} = vi.hoisted(() => ({
  mockGetCampaignBySlug: vi.fn(),
  mockUploadSubmissionImage: vi.fn(),
  mockSubmitTribute: vi.fn(),
  mockReportSubmissionError: vi.fn(),
  mockCompositeFrameToBlob: vi.fn(),
}));

vi.mock("../../queries/campaign.queries", () => ({
  campaignBySlugQueryOptions: (slug: string) => ({
    queryKey: ["campaigns", "by-slug", slug],
    queryFn: () => mockGetCampaignBySlug(slug),
  }),
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
    avatarBox: { top: 335, left: 200, width: 286, height: 260, shape: "circle" as const },
    nameBox: { top: 605, left: 159, width: 389, height: 40, shrinkAt: 29, textColor: "#ffffff" },
    roleBox: { top: 650, left: 157, width: 389, height: 45, shrinkAt: 20, textColor: "#ffffff" },
    messageBox: { top: 358, left: 506, width: 801, height: 229, textColor: "#000" },
  },
  backgroundImageUrl:
    "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
  musicUrl: null,
  visibility: "private" as const,
  status: "approved" as const,
  submissionCount: 0,
  createdAt: "2026-07-18T00:00:00.000Z",
};

const COMPOSITED_BLOB = new Blob(["composited"], { type: "image/jpeg" });

function renderAtSlug(slug: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/:slug" element={<CampaignPublicPage />} />
    </Routes>,
    { route: `/${slug}` },
  );
}

describe("CampaignPublicPage", () => {
  beforeEach(() => {
    mockGetCampaignBySlug.mockReset();
    mockUploadSubmissionImage.mockReset();
    mockSubmitTribute.mockReset();
    mockReportSubmissionError.mockClear();
    mockCompositeFrameToBlob.mockReset();
    mockCompositeFrameToBlob.mockResolvedValue(COMPOSITED_BLOB);
  });

  it("shows a loading state while the campaign is being resolved", () => {
    // Never resolves — the assertion below only cares about the loading state.
    mockGetCampaignBySlug.mockReturnValue(new Promise(() => undefined));
    renderAtSlug("dai-hoi-ben-tre");

    expect(screen.getByText("Đang tải...")).toBeTruthy();
  });

  it("shows the not-found page, with no campaign content, when the campaign is null (pending/rejected/suspended/nonexistent — RLS makes these indistinguishable)", async () => {
    mockGetCampaignBySlug.mockResolvedValue(null);
    renderAtSlug("not-approved-or-missing");

    await screen.findByText("404");
    expect(screen.queryByAltText("Hiện đại")).toBeNull();
  });

  it("renders the campaign template + background for an approved campaign, even with no submission content", async () => {
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    const { container } = renderAtSlug("dai-hoi-ben-tre");

    await screen.findByText("submit-tribute-form");
    const backgroundImg = container.querySelector(
      `img[src="${APPROVED_CAMPAIGN.backgroundImageUrl}"]`,
    );
    expect(backgroundImg).toBeTruthy();
  });

  it('shows a "campaign full" notice instead of the form when the submission cap has been reached', async () => {
    mockGetCampaignBySlug.mockResolvedValue({
      ...APPROVED_CAMPAIGN,
      submissionCount: 5000,
    });
    renderAtSlug("dai-hoi-ben-tre");

    await screen.findByText("Chiến dịch đã đủ số lượng gửi");
    expect(screen.queryByText("submit-tribute-form")).toBeNull();
  });

  it("composites the frame first, uploads only the composited image (never the raw avatar), submits the tribute, and shows the download view", async () => {
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionImage.mockResolvedValue(
      "https://cdn.example.com/submissions/campaign-1/abc.jpg",
    );
    mockSubmitTribute.mockResolvedValue({ id: "submission-1" });
    renderAtSlug("dai-hoi-ben-tre");

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
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockCompositeFrameToBlob.mockRejectedValue(failure);
    renderAtSlug("dai-hoi-ben-tre");

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
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionImage.mockResolvedValue(
      "https://cdn.example.com/submissions/campaign-1/abc.jpg",
    );
    mockSubmitTribute.mockRejectedValue(
      new SubmissionServiceError(
        "Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.",
        { code: "CAMPAIGN_FULL" },
      ),
    );
    renderAtSlug("dai-hoi-ben-tre");

    await screen.findByText("submit-tribute-form");
    fireEvent.click(screen.getByText("submit-tribute-form"));

    await screen.findByText("Chiến dịch đã đủ số lượng gửi");
    expect(mockReportSubmissionError).not.toHaveBeenCalled();
  });

  it("reports a friendly error for any other submission failure and stays on the form", async () => {
    const failure = new Error("network error");
    mockGetCampaignBySlug.mockResolvedValue(APPROVED_CAMPAIGN);
    mockUploadSubmissionImage.mockRejectedValue(failure);
    renderAtSlug("dai-hoi-ben-tre");

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
