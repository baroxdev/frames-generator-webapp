import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { EditCampaignPage } from "./EditCampaignPage";

const {
  mockUseAuthSession,
  mockListCampaignsForOwner,
  mockUpdateCampaignDetails,
  mockUploadCampaignBackground,
  mockUploadCampaignHeader,
  mockNavigate,
  mockReportCampaignError,
} = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockListCampaignsForOwner: vi.fn(),
  mockUpdateCampaignDetails: vi.fn(),
  mockUploadCampaignBackground: vi.fn(),
  mockUploadCampaignHeader: vi.fn(),
  mockNavigate: vi.fn(),
  mockReportCampaignError: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../hooks/useAuthSession", () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock("../../queries/campaign.queries", () => ({
  campaignKeys: {
    list: () => ["campaigns", "list"],
    bySlug: (slug: string) => ["campaigns", "by-slug", slug],
  },
  campaignsQueryOptions: () => ({
    queryKey: ["campaigns", "list"],
    queryFn: mockListCampaignsForOwner,
  }),
  campaignBySlugQueryOptions: (slug: string) => ({
    queryKey: ["campaigns", "by-slug", slug],
  }),
  updateCampaignDetailsMutationOptions: () => ({
    mutationFn: mockUpdateCampaignDetails,
  }),
  uploadCampaignBackgroundMutationOptions: () => ({
    mutationFn: mockUploadCampaignBackground,
  }),
  uploadCampaignHeaderMutationOptions: () => ({
    mutationFn: mockUploadCampaignHeader,
  }),
  uploadCampaignFontMutationOptions: () => ({
    mutationFn: vi.fn(),
  }),
}));

vi.mock("../../utils/report-campaign-error", () => ({
  reportCampaignError: mockReportCampaignError,
}));

// LayoutEditor's own interaction is covered by its own dedicated tests —
// this page's tests only need the load -> edit -> save orchestration, so a
// minimal stand-in that calls onChange with a fixed edited layout is enough.
vi.mock("../../components/campaigns/LayoutEditor", () => ({
  LayoutEditor: ({ onChange }: { onChange: (layout: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ edited: true })}>
      edit-layout-placeholder
    </button>
  ),
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
  submissionCount: 0,
  createdAt: "2026-07-18T00:00:00.000Z",
  title: null,
  description: null,
  thumbnailUrl: null,
  headerImageUrl: null,
};

async function renderAtId(id: string) {
  return await renderWithProviders(<EditCampaignPage />, {
    route: `/campaigns/${id}/edit`,
    path: "/campaigns/$id/edit",
    additionalRoutes: [
      { path: "/login", element: <div>login-page-placeholder</div> },
    ],
  });
}

describe("EditCampaignPage", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockListCampaignsForOwner.mockReset();
    mockUpdateCampaignDetails.mockReset();
    mockUploadCampaignBackground.mockReset();
    mockUploadCampaignHeader.mockReset();
    mockNavigate.mockClear();
    mockReportCampaignError.mockClear();
    mockUseAuthSession.mockReturnValue({
      session: {},
      user: { id: "user-1" },
      isLoading: false,
      error: null,
    });
    mockListCampaignsForOwner.mockResolvedValue([CAMPAIGN]);
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

  it("loads the campaign and seeds SEO fields, header state, and the layout editor", async () => {
    mockListCampaignsForOwner.mockResolvedValue([
      { ...CAMPAIGN, title: "Đại hội Bến Tre", description: "Mô tả hiện tại." },
    ]);
    await renderAtId("campaign-1");

    expect(await screen.findByText("/dai-hoi-ben-tre")).toBeTruthy();
    expect(screen.getByDisplayValue("Đại hội Bến Tre")).toBeTruthy();
    expect(screen.getByDisplayValue("Mô tả hiện tại.")).toBeTruthy();
    expect(screen.getByText("Chưa có ảnh bìa")).toBeTruthy();
    expect(screen.getByText("edit-layout-placeholder")).toBeTruthy();
  });

  it("renders the existing header image, without a fixed aspect ratio wrapper, when one is already set", async () => {
    mockListCampaignsForOwner.mockResolvedValue([
      { ...CAMPAIGN, headerImageUrl: "https://cdn.example.com/header.jpg" },
    ]);
    await renderAtId("campaign-1");

    await screen.findByText("/dai-hoi-ben-tre");
    expect(screen.getByRole("button", { name: "Đổi ảnh bìa" })).toBeTruthy();
    expect(screen.queryByText("Chưa có ảnh bìa")).toBeNull();
  });

  it("saves SEO fields, header image, and layout together, invalidates caches, and navigates back to /campaigns", async () => {
    mockUploadCampaignHeader.mockResolvedValue(
      "https://cdn.example.com/new-header.jpg",
    );
    mockUpdateCampaignDetails.mockResolvedValue(CAMPAIGN);
    await renderAtId("campaign-1");

    await screen.findByText("/dai-hoi-ben-tre");
    fireEvent.change(screen.getByLabelText("Tiêu đề"), {
      target: { value: "Đại hội Bến Tre" },
    });
    fireEvent.change(screen.getByLabelText("Mô tả"), {
      target: { value: "Gửi lời chúc mừng của bạn." },
    });
    fireEvent.click(screen.getByText("edit-layout-placeholder"));

    const headerFile = new File(["header"], "header.jpg", {
      type: "image/jpeg",
    });
    const headerInput = screen
      .getByRole("button", { name: "Tải ảnh bìa lên" })
      .closest(".ant-upload")
      ?.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(headerInput, { target: { files: [headerFile] } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Đổi ảnh bìa" })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(mockUploadCampaignHeader).toHaveBeenCalledWith(
        headerFile,
        expect.anything(),
      ),
    );
    expect(mockUploadCampaignBackground).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockUpdateCampaignDetails).toHaveBeenCalledWith(
        {
          campaignId: "campaign-1",
          details: {
            title: "Đại hội Bến Tre",
            description: "Gửi lời chúc mừng của bạn.",
            thumbnailUrl: null,
            headerImageUrl: "https://cdn.example.com/new-header.jpg",
            backgroundImageUrl: CAMPAIGN.backgroundImageUrl,
            layout: { edited: true },
          },
        },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/campaigns" }),
    );
  });

  it("keeps the existing header/thumbnail URLs when no new file is chosen", async () => {
    mockUpdateCampaignDetails.mockResolvedValue(CAMPAIGN);
    mockListCampaignsForOwner.mockResolvedValue([
      {
        ...CAMPAIGN,
        thumbnailUrl: "https://cdn.example.com/thumb.jpg",
        headerImageUrl: "https://cdn.example.com/header.jpg",
      },
    ]);
    await renderAtId("campaign-1");

    await screen.findByText("/dai-hoi-ben-tre");
    fireEvent.click(screen.getByText("edit-layout-placeholder"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(mockUpdateCampaignDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            thumbnailUrl: "https://cdn.example.com/thumb.jpg",
            headerImageUrl: "https://cdn.example.com/header.jpg",
            backgroundImageUrl: CAMPAIGN.backgroundImageUrl,
          }),
        }),
        expect.anything(),
      ),
    );
    expect(mockUploadCampaignHeader).not.toHaveBeenCalled();
    expect(mockUploadCampaignBackground).not.toHaveBeenCalled();
  });

  it("uploads a new background image and includes it in the saved details when chosen", async () => {
    mockUploadCampaignBackground.mockResolvedValue(
      "https://cdn.example.com/new-bg.jpg",
    );
    mockUpdateCampaignDetails.mockResolvedValue(CAMPAIGN);
    await renderAtId("campaign-1");

    await screen.findByText("/dai-hoi-ben-tre");
    fireEvent.click(screen.getByText("edit-layout-placeholder"));

    const backgroundFile = new File(["bg"], "bg.jpg", { type: "image/jpeg" });
    const backgroundButtons = screen.getAllByRole("button", { name: "Đổi ảnh nền" });
    console.log("DEBUG backgroundButtons count", backgroundButtons.length);
    const backgroundInput = backgroundButtons[0]
      .closest(".ant-upload")
      ?.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(backgroundInput, { target: { files: [backgroundFile] } });

    await waitFor(() => {
      const imgs = document.querySelectorAll("img");
      console.log(
        "DEBUG imgs",
        Array.from(imgs).map((i) => i.getAttribute("src")),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(mockUploadCampaignBackground).toHaveBeenCalledWith(
        backgroundFile,
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockUpdateCampaignDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            backgroundImageUrl: "https://cdn.example.com/new-bg.jpg",
          }),
        }),
        expect.anything(),
      ),
    );
  });

  it("reports a friendly error and stays on the page when saving fails", async () => {
    const failure = new Error("network error");
    mockUpdateCampaignDetails.mockRejectedValue(failure);
    await renderAtId("campaign-1");

    await screen.findByText("/dai-hoi-ben-tre");
    fireEvent.click(screen.getByText("edit-layout-placeholder"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(mockReportCampaignError).toHaveBeenCalledWith(
        failure,
        "Không thể lưu chiến dịch. Vui lòng thử lại.",
      ),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
