import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";

const { mockReset, mockLoadFacebookSdk, mockOpenShareDialog } = vi.hoisted(() => ({
  mockReset: vi.fn(),
  mockLoadFacebookSdk: vi.fn(),
  mockOpenShareDialog: vi.fn(),
}));

vi.mock("../../lib/facebookSdk", () => ({
  loadFacebookSdk: mockLoadFacebookSdk,
  openShareDialog: mockOpenShareDialog,
}));

vi.mock("../auth/TurnstileWidget", () => ({
  TurnstileWidget: forwardRef(function MockTurnstileWidget(
    { onVerify }: { onVerify: (token: string) => void },
    ref: React.Ref<{ reset: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({ reset: mockReset }));
    return (
      <button type="button" onClick={() => onVerify("turnstile-token")}>
        Verify CAPTCHA
      </button>
    );
  }),
}));

// ImgCrop's own crop-modal interaction isn't TributeForm's concern to test —
// this passthrough lets the wrapped Upload's beforeUpload/onChange fire
// directly on file selection, same as if no cropping step were in the way.
vi.mock("antd-img-crop", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import { TributeForm } from "./TributeForm";
import type { TributeSubmitValues } from "./TributeForm";

function renderTributeForm(
  onSubmit: (values: TributeSubmitValues) => Promise<void>,
  metadata?: { resultImage: string | null },
) {
  function Harness() {
    const form = useForm<TributeSubmitValues>({
      defaultValues: {
        fullName: "",
        role: "",
        message: "",
        avatar: { file: null },
        turnstileToken: "",
      },
    });

    return (
      <TributeForm
        turnstileSiteKey="test-site-key"
        facebookAppId="test-fb-app-id"
        shareUrl="https://example.com/dai-hoi"
        isSubmitting={false}
        onSubmit={onSubmit}
        form={form}
        metadata={metadata}
      />
    );
  }

  return render(<Harness />);
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Họ và tên"), {
    target: { value: "Nguyễn Văn A" },
  });
  fireEvent.change(screen.getByLabelText("Đơn vị / Chức vụ"), {
    target: { value: "Cựu học sinh khóa 2010" },
  });
  fireEvent.change(screen.getByLabelText("Thông điệp"), {
    target: { value: "Chúc mừng đại hội thành công tốt đẹp!" },
  });

  const avatarFile = new File(["avatar"], "avatar.jpg", { type: "image/jpeg" });
  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [avatarFile] } });

  fireEvent.click(screen.getByText("Verify CAPTCHA"));
}

describe("TributeForm", () => {
  beforeEach(() => {
    mockReset.mockClear();
    mockLoadFacebookSdk.mockReset();
    mockOpenShareDialog.mockReset();
    mockLoadFacebookSdk.mockResolvedValue({ init: vi.fn(), ui: vi.fn() });
  });

  it("shows validation errors and does not submit when required fields are missing", async () => {
    const onSubmit = vi.fn();
    renderTributeForm(onSubmit);

    fireEvent.click(screen.getByText("Gửi thông điệp"));

    await waitFor(() =>
      expect(screen.getByText("Vui lòng thêm ảnh đại diện")).toBeTruthy(),
    );
    expect(screen.getByText("Vui lòng xác thực CAPTCHA")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the full payload (including the avatar file and turnstile token) once every field is valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderTributeForm(onSubmit);

    fillValidForm();
    fireEvent.click(screen.getByText("Gửi thông điệp"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.fullName).toBe("Nguyễn Văn A");
    expect(submitted.role).toBe("Cựu học sinh khóa 2010");
    expect(submitted.message).toBe("Chúc mừng đại hội thành công tốt đẹp!");
    expect(submitted.avatar.file).toBeInstanceOf(File);
    expect(submitted.turnstileToken).toBe("turnstile-token");
  });

  it("resets the Turnstile widget and clears the token when the submission rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("campaign full"));
    renderTributeForm(onSubmit);

    fillValidForm();
    fireEvent.click(screen.getByText("Gửi thông điệp"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));

    // The token was cleared, so submitting again without re-verifying is blocked client-side.
    fireEvent.click(screen.getByText("Gửi thông điệp"));
    await waitFor(() =>
      expect(screen.getByText("Vui lòng xác thực CAPTCHA")).toBeTruthy(),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the consent notice near the submit action", () => {
    renderTributeForm(vi.fn());

    expect(
      screen.getByText(
        "Bằng việc gửi, bạn đồng ý cho phép chiến dịch sử dụng ảnh và thông tin này để tạo khung ảnh tri ân công khai.",
      ),
    ).toBeTruthy();
  });

  it("disables the footer download button until a result image exists", () => {
    renderTributeForm(vi.fn());

    const button = screen.getByText("Tải về").closest("button");
    expect(button?.disabled).toBe(true);
  });

  it("opens the result dialog automatically once a result image is available", async () => {
    renderTributeForm(vi.fn(), { resultImage: "https://cdn.example.com/result.jpg" });

    expect(
      await screen.findByText("Ảnh khung tri ân của bạn"),
    ).toBeTruthy();
    expect(screen.getByAltText("Khung ảnh tri ân").getAttribute("src")).toBe(
      "https://cdn.example.com/result.jpg",
    );
  });

  it("downloads the result image as a same-origin blob instead of navigating to the remote URL", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    renderTributeForm(vi.fn(), { resultImage: "https://cdn.example.com/result.jpg" });
    await screen.findByText("Ảnh khung tri ân của bạn");

    fireEvent.click(screen.getByText("Tải về máy"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.com/result.jpg"),
    );
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(blob));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    vi.unstubAllGlobals();
  });

  it("opens the Facebook share dialog for the campaign's public URL when sharing", async () => {
    renderTributeForm(vi.fn(), { resultImage: "https://cdn.example.com/result.jpg" });
    await screen.findByText("Ảnh khung tri ân của bạn");

    fireEvent.click(screen.getByText("Chia sẻ Facebook"));

    expect(mockOpenShareDialog).toHaveBeenCalledWith(
      "test-fb-app-id",
      "https://example.com/dai-hoi",
    );
  });
});
