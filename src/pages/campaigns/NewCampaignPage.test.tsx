import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { NewCampaignPage } from "./NewCampaignPage";

const {
  mockUseAuthSession,
  mockNavigate,
  mockUpload,
  mockUploadHeader,
  mockCreate,
  mockIsSlugAvailable,
  mockReportCampaignError,
  mockGetImageDimensions,
} = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockUpload: vi.fn(),
  mockUploadHeader: vi.fn(),
  mockCreate: vi.fn(),
  mockIsSlugAvailable: vi.fn(),
  mockReportCampaignError: vi.fn(),
  mockGetImageDimensions: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Debouncing has no useful behavior to assert on here (it only delays when
// the availability check fires) — replaced with an identity pass-through so
// tests don't need fake timers.
vi.mock("use-debounce", () => ({
  useDebounce: (value: string) => [value],
}));

vi.mock("../../hooks/useAuthSession", () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock("../../queries/campaign.queries", () => ({
  campaignKeys: { list: () => ["campaigns", "list"] },
  uploadCampaignBackgroundMutationOptions: () => ({ mutationFn: mockUpload }),
  uploadCampaignHeaderMutationOptions: () => ({ mutationFn: mockUploadHeader }),
  createCampaignMutationOptions: () => ({ mutationFn: mockCreate }),
  slugAvailabilityQueryOptions: (slug: string) => ({
    queryKey: ["campaigns", "slug-availability", slug],
    queryFn: () => mockIsSlugAvailable(slug),
  }),
}));

vi.mock("../../utils/report-campaign-error", () => ({
  reportCampaignError: mockReportCampaignError,
}));

vi.mock("../../utils/get-image-dimensions", () => ({
  getImageDimensions: mockGetImageDimensions,
}));

// LayoutEditor's own interaction (drag/resize/shape/color) is covered by its
// own dedicated tests — this page's tests only need to exercise the
// upload -> default-layout -> submit orchestration around it, same
// rationale as CampaignPublicPage.test.tsx's TributeForm stand-in.
vi.mock("../../components/campaigns/LayoutEditor", () => ({
  LayoutEditor: () => <div>layout-editor-placeholder</div>,
}));

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Đường dẫn"), {
    target: { value: "dai-hoi-ben-tre" },
  });
  const file = new File(["background"], "bg.jpg", { type: "image/jpeg" });
  // antd's Upload.Dragger renders a native <input type="file"> under its
  // drop zone rather than exposing an aria-label on it directly.
  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });
}

describe("NewCampaignPage", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockNavigate.mockClear();
    mockUpload.mockReset();
    mockUploadHeader.mockReset();
    mockCreate.mockReset();
    mockIsSlugAvailable.mockReset();
    mockIsSlugAvailable.mockResolvedValue(true);
    mockReportCampaignError.mockClear();
    mockGetImageDimensions.mockReset();
    mockGetImageDimensions.mockResolvedValue({ width: 1500, height: 843 });
    mockUseAuthSession.mockReturnValue({
      session: {},
      user: { id: "user-1" },
      isLoading: false,
      error: null,
    });
  });

  it("shows a loading state while the session resolves", async () => {
    mockUseAuthSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: true,
      error: null,
    });
    await renderWithProviders(<NewCampaignPage />);

    expect(screen.getByText("Đang tải...")).toBeTruthy();
  });

  it("redirects to /login when there is no session", async () => {
    mockUseAuthSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      error: null,
    });
    await renderWithProviders(<NewCampaignPage />, {
      route: "/campaigns/new",
      additionalRoutes: [
        { path: "/login", element: <div>login-page-placeholder</div> },
      ],
    });

    expect(screen.getByText("login-page-placeholder")).toBeTruthy();
  });

  it("shows validation errors and never calls the mutations when the slug is invalid and no background is chosen", async () => {
    await renderWithProviders(<NewCampaignPage />);

    fireEvent.change(screen.getByLabelText("Đường dẫn"), {
      target: { value: "ab" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));

    await screen.findByText("Đường dẫn cần có ít nhất 3 ký tự");
    expect(screen.getByText("Vui lòng tải ảnh nền lên")).toBeTruthy();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows the live availability result once the slug passes format validation", async () => {
    mockIsSlugAvailable.mockResolvedValue(false);
    await renderWithProviders(<NewCampaignPage />);

    fireEvent.change(screen.getByLabelText("Đường dẫn"), {
      target: { value: "dai-hoi-ben-tre" },
    });

    await screen.findByText("Đường dẫn này đã được sử dụng");
  });

  it("uploads the background, creates the campaign with the computed default layout, invalidates the list, and navigates to /campaigns", async () => {
    mockUpload.mockResolvedValue(
      "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
    );
    mockCreate.mockResolvedValue({ id: "campaign-1", slug: "dai-hoi-ben-tre" });
    await renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    await screen.findByText("layout-editor-placeholder");
    fireEvent.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));

    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(File),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        {
          slug: "dai-hoi-ben-tre",
          // The mocked upload resolves a 1500x843 image — modernPortrait's
          // own canvas size — so the default layout's scale factor is 1:1
          // and comes back identical to its source box coordinates (see
          // src/templates/gallery.ts), just with an explicit textColor
          // filled in wherever modernPortrait relied on a component's
          // implicit default.
          layout: {
            canvas: { width: 1500, height: 843 },
            avatarBox: {
              top: 335,
              left: 200,
              width: 286,
              height: 260,
              shape: "circle",
            },
            nameBox: {
              top: 605,
              left: 159,
              width: 389,
              height: 40,
              autoFit: true,
              textColor: "#ffffff",
            },
            roleBox: {
              top: 650,
              left: 157,
              width: 389,
              height: 45,
              autoFit: true,
              textColor: "#ffffff",
            },
            messageBox: {
              top: 358,
              left: 506,
              width: 801,
              height: 229,
              autoFit: true,
              textColor: "#000",
            },
            fontFamily: "Be Vietnam Pro",
          },
          backgroundImageUrl:
            "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
        },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/campaigns" }),
    );
  });

  it("includes title, description, and an uploaded thumbnail URL in the create payload when filled in", async () => {
    mockUpload.mockResolvedValueOnce(
      "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
    );
    mockUpload.mockResolvedValueOnce(
      "https://cdn.example.com/campaign-backgrounds/user-1/thumb.jpg",
    );
    mockCreate.mockResolvedValue({ id: "campaign-1", slug: "dai-hoi-ben-tre" });
    await renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    await screen.findByText("layout-editor-placeholder");
    fireEvent.change(screen.getByLabelText("Tiêu đề"), {
      target: { value: "Đại hội Bến Tre" },
    });
    fireEvent.change(screen.getByLabelText("Mô tả"), {
      target: { value: "Gửi lời chúc mừng của bạn." },
    });
    const thumbnailFile = new File(["thumb"], "thumb.jpg", {
      type: "image/jpeg",
    });
    // fillValidForm() already selected a background file, which swaps that
    // section's <Upload.Dragger> input out for a preview (no input) — so
    // only the thumbnail (0) and header banner (1) inputs remain at this
    // point, in that DOM order.
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], {
      target: { files: [thumbnailFile] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Đại hội Bến Tre",
          description: "Gửi lời chúc mừng của bạn.",
          thumbnailUrl:
            "https://cdn.example.com/campaign-backgrounds/user-1/thumb.jpg",
        }),
        expect.anything(),
      ),
    );
  });

  it("includes an uploaded header image URL in the create payload when one is chosen", async () => {
    mockUpload.mockResolvedValue(
      "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
    );
    mockUploadHeader.mockResolvedValue(
      "https://cdn.example.com/campaign-headers/user-1/header.jpg",
    );
    mockCreate.mockResolvedValue({ id: "campaign-1", slug: "dai-hoi-ben-tre" });
    await renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    await screen.findByText("layout-editor-placeholder");
    const headerFile = new File(["header"], "header.jpg", {
      type: "image/jpeg",
    });
    // See the thumbnail test above: only thumbnail (0) and header banner (1)
    // inputs remain once fillValidForm() has already picked a background.
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[1], { target: { files: [headerFile] } });

    fireEvent.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));

    await waitFor(() =>
      expect(mockUploadHeader).toHaveBeenCalledWith(
        headerFile,
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          headerImageUrl:
            "https://cdn.example.com/campaign-headers/user-1/header.jpg",
        }),
        expect.anything(),
      ),
    );
  });

  it("omits title, description, thumbnailUrl, and headerImageUrl from the create payload when left blank", async () => {
    mockUpload.mockResolvedValue(
      "https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg",
    );
    mockCreate.mockResolvedValue({ id: "campaign-1", slug: "dai-hoi-ben-tre" });
    await renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    await screen.findByText("layout-editor-placeholder");
    fireEvent.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const payload = mockCreate.mock.calls[0][0];
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("description");
    expect(payload).not.toHaveProperty("thumbnailUrl");
    expect(payload).not.toHaveProperty("headerImageUrl");
    expect(mockUploadHeader).not.toHaveBeenCalled();
  });

  it("reports a friendly error and stays on the page when the upload fails", async () => {
    const failure = new Error("upload failed");
    mockUpload.mockRejectedValue(failure);
    await renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    await screen.findByText("layout-editor-placeholder");
    fireEvent.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));

    await waitFor(() =>
      expect(mockReportCampaignError).toHaveBeenCalledWith(
        failure,
        "Không thể tạo chiến dịch. Vui lòng thử lại.",
      ),
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
