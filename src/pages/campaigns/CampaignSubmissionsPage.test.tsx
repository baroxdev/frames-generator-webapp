import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { CampaignSubmissionsPage } from "./CampaignSubmissionsPage";

const {
  mockUseAuthSession,
  mockListCampaignsForOwner,
  mockListSubmissionsForCampaign,
  mockDeleteSubmission,
  mockReportSubmissionError,
  mockExportSubmissionsToExcel,
  mockDownloadImage,
} = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockListCampaignsForOwner: vi.fn(),
  mockListSubmissionsForCampaign: vi.fn(),
  mockDeleteSubmission: vi.fn(),
  mockReportSubmissionError: vi.fn(),
  mockExportSubmissionsToExcel: vi.fn(),
  mockDownloadImage: vi.fn(),
}));

vi.mock("../../hooks/useAuthSession", () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock("../../queries/campaign.queries", () => ({
  campaignKeys: { list: () => ["campaigns", "list"] },
  campaignsQueryOptions: () => ({
    queryKey: ["campaigns", "list"],
    queryFn: mockListCampaignsForOwner,
  }),
}));

vi.mock("../../queries/submission.queries", () => ({
  submissionKeys: {
    listByCampaign: (id: string) => ["submissions", "by-campaign", id],
  },
  submissionsByCampaignQueryOptions: (id: string) => ({
    queryKey: ["submissions", "by-campaign", id],
    queryFn: mockListSubmissionsForCampaign,
  }),
  deleteSubmissionMutationOptions: () => ({ mutationFn: mockDeleteSubmission }),
}));

vi.mock("../../utils/report-submission-error", () => ({
  reportSubmissionError: mockReportSubmissionError,
}));

vi.mock("../../utils/exportSubmissionsToExcel", () => ({
  exportSubmissionsToExcel: mockExportSubmissionsToExcel,
}));

vi.mock("../../utils/downloadImage", () => ({
  downloadImage: mockDownloadImage,
}));

const CAMPAIGN = {
  id: "campaign-1",
  ownerId: "user-1",
  slug: "dai-hoi-ben-tre",
  templateId: null,
  layout: { canvas: { width: 1500, height: 843 } },
  backgroundImageUrl: "https://cdn.example.com/bg.jpg",
  musicUrl: null,
  visibility: "private" as const,
  status: "approved" as const,
  submissionCount: 2,
  createdAt: "2026-07-18T00:00:00.000Z",
};

const SUBMISSIONS = [
  {
    id: "submission-1",
    campaignId: "campaign-1",
    fullName: "Nguyễn Văn A",
    role: "Cựu học sinh",
    message: "Chúc mừng đại hội!",
    imageUrl: "https://cdn.example.com/submissions/campaign-1/a.jpg",
    createdAt: "2026-07-18T00:00:00.000Z",
  },
  {
    id: "submission-2",
    campaignId: "campaign-1",
    fullName: "Trần Thị B",
    role: "Giáo viên",
    message: "Chúc mừng đại hội lần 2!",
    imageUrl: "https://cdn.example.com/submissions/campaign-1/b.jpg",
    createdAt: "2026-07-18T01:00:00.000Z",
  },
];

async function renderAtId(id: string) {
  return await renderWithProviders(<CampaignSubmissionsPage />, {
    route: `/campaigns/${id}/submissions`,
    path: "/campaigns/$id/submissions",
    additionalRoutes: [
      { path: "/login", element: <div>login-page-placeholder</div> },
    ],
  });
}

describe("CampaignSubmissionsPage", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockListCampaignsForOwner.mockReset();
    mockListSubmissionsForCampaign.mockReset();
    mockDeleteSubmission.mockReset();
    mockReportSubmissionError.mockClear();
    mockExportSubmissionsToExcel.mockClear();
    mockDownloadImage.mockReset();
    mockUseAuthSession.mockReturnValue({
      session: {},
      user: { id: "user-1" },
      isLoading: false,
      error: null,
    });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
    mockListSubmissionsForCampaign.mockResolvedValue(SUBMISSIONS);
  });

  it("redirects to /login when there is no session", async () => {
    mockUseAuthSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      error: null,
    });
    await renderAtId("campaign-1");

    expect(screen.getByText("login-page-placeholder")).toBeTruthy();
  });

  it("shows an error when no campaign with that id belongs to the owner", async () => {
    mockListCampaignsForOwner.mockResolvedValue([]);
    await renderAtId("unknown-id");

    expect(
      await screen.findByText("Không tìm thấy chiến dịch này."),
    ).toBeTruthy();
  });

  it("lists submissions and the count against the 5,000 cap", async () => {
    await renderAtId("campaign-1");

    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("Trần Thị B")).toBeTruthy();
    expect(screen.getByText("2 / 200000")).toBeTruthy();
  });

  it("deletes a submission and invalidates the submissions and campaigns caches", async () => {
    mockDeleteSubmission.mockResolvedValue({ id: "submission-1" });
    await renderAtId("campaign-1");
    await screen.findByText("Nguyễn Văn A");

    fireEvent.click(screen.getAllByLabelText("Xoá thông điệp")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Xoá" }));

    await waitFor(() =>
      expect(mockDeleteSubmission).toHaveBeenCalledWith(
        "submission-1",
        expect.anything(),
      ),
    );
  });

  it("reports a friendly error when delete fails", async () => {
    const failure = new Error("network error");
    mockDeleteSubmission.mockRejectedValue(failure);
    await renderAtId("campaign-1");
    await screen.findByText("Nguyễn Văn A");

    fireEvent.click(screen.getAllByLabelText("Xoá thông điệp")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Xoá" }));

    await waitFor(() =>
      expect(mockReportSubmissionError).toHaveBeenCalledWith(
        failure,
        "Không thể xoá thông điệp. Vui lòng thử lại.",
      ),
    );
  });

  it("exports the loaded submissions to Excel", async () => {
    await renderAtId("campaign-1");
    await screen.findByText("Nguyễn Văn A");

    fireEvent.click(screen.getByRole("button", { name: /Xuất Excel/ }));

    expect(mockExportSubmissionsToExcel).toHaveBeenCalledWith(
      SUBMISSIONS,
      "submissions-dai-hoi-ben-tre.xlsx",
    );
  });

  it("downloads a single submission image when its row download button is clicked", async () => {
    mockDownloadImage.mockResolvedValue(undefined);
    await renderAtId("campaign-1");
    await screen.findByText("Nguyễn Văn A");

    fireEvent.click(screen.getAllByLabelText("Tải ảnh")[0]);

    await waitFor(() =>
      expect(mockDownloadImage).toHaveBeenCalledWith(
        "https://cdn.example.com/submissions/campaign-1/a.jpg",
        expect.stringContaining("submission-1".slice(0, 8)),
      ),
    );
  });

  it("reports a friendly error when a single-image download fails", async () => {
    const failure = new Error("network error");
    mockDownloadImage.mockRejectedValue(failure);
    await renderAtId("campaign-1");
    await screen.findByText("Nguyễn Văn A");

    fireEvent.click(screen.getAllByLabelText("Tải ảnh")[0]);

    await waitFor(() =>
      expect(mockReportSubmissionError).toHaveBeenCalledWith(
        failure,
        "Không thể tải ảnh. Vui lòng thử lại.",
      ),
    );
  });
});
