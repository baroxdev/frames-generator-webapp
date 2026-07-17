import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { NewCampaignPage } from './NewCampaignPage';

const {
  mockUseAuthSession,
  mockNavigate,
  mockUpload,
  mockCreate,
  mockIsSlugAvailable,
  mockReportCampaignError,
} = vi.hoisted(() => ({
  mockUseAuthSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockUpload: vi.fn(),
  mockCreate: vi.fn(),
  mockIsSlugAvailable: vi.fn(),
  mockReportCampaignError: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Debouncing has no useful behavior to assert on here (it only delays when
// the availability check fires) — replaced with an identity pass-through so
// tests don't need fake timers.
vi.mock('use-debounce', () => ({
  useDebounce: (value: string) => [value],
}));

vi.mock('../../hooks/useAuthSession', () => ({
  useAuthSession: mockUseAuthSession,
}));

vi.mock('../../queries/campaign.queries', () => ({
  campaignKeys: { list: () => ['campaigns', 'list'] },
  uploadCampaignBackgroundMutationOptions: () => ({ mutationFn: mockUpload }),
  createCampaignMutationOptions: () => ({ mutationFn: mockCreate }),
  slugAvailabilityQueryOptions: (slug: string) => ({
    queryKey: ['campaigns', 'slug-availability', slug],
    queryFn: () => mockIsSlugAvailable(slug),
  }),
}));

vi.mock('../../utils/report-campaign-error', () => ({
  reportCampaignError: mockReportCampaignError,
}));

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Đường dẫn'), { target: { value: 'dai-hoi-ben-tre' } });
  const file = new File(['background'], 'bg.jpg', { type: 'image/jpeg' });
  // antd's Upload.Dragger renders a native <input type="file"> under its
  // drop zone rather than exposing an aria-label on it directly.
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });
}

describe('NewCampaignPage', () => {
  beforeEach(() => {
    mockUseAuthSession.mockReset();
    mockNavigate.mockClear();
    mockUpload.mockReset();
    mockCreate.mockReset();
    mockIsSlugAvailable.mockReset();
    mockIsSlugAvailable.mockResolvedValue(true);
    mockReportCampaignError.mockClear();
    mockUseAuthSession.mockReturnValue({ session: {}, user: { id: 'user-1' }, isLoading: false, error: null });
  });

  it('shows a loading state while the session resolves', () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: true, error: null });
    renderWithProviders(<NewCampaignPage />);

    expect(screen.getByText('Đang tải...')).toBeTruthy();
  });

  it('redirects to /login when there is no session', async () => {
    mockUseAuthSession.mockReturnValue({ session: null, user: null, isLoading: false, error: null });
    const { Route, Routes } = await import('react-router-dom');
    renderWithProviders(
      <Routes>
        <Route path="/campaigns/new" element={<NewCampaignPage />} />
        <Route path="/login" element={<div>login-page-placeholder</div>} />
      </Routes>,
      { route: '/campaigns/new' },
    );

    expect(screen.getByText('login-page-placeholder')).toBeTruthy();
  });

  it('shows validation errors and never calls the mutations when the slug is invalid and no background is chosen', async () => {
    renderWithProviders(<NewCampaignPage />);

    fireEvent.change(screen.getByLabelText('Đường dẫn'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }));

    await screen.findByText('Đường dẫn cần có ít nhất 3 ký tự');
    expect(screen.getByText('Vui lòng tải ảnh nền lên')).toBeTruthy();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows the live availability result once the slug passes format validation', async () => {
    mockIsSlugAvailable.mockResolvedValue(false);
    renderWithProviders(<NewCampaignPage />);

    fireEvent.change(screen.getByLabelText('Đường dẫn'), { target: { value: 'dai-hoi-ben-tre' } });

    await screen.findByText('Đường dẫn này đã được sử dụng');
  });

  it('uploads the background, creates the campaign, invalidates the list, and navigates to /campaigns', async () => {
    mockUpload.mockResolvedValue('https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg');
    mockCreate.mockResolvedValue({ id: 'campaign-1', slug: 'dai-hoi-ben-tre' });
    renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(expect.any(File), expect.anything()));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        {
          slug: 'dai-hoi-ben-tre',
          templateId: 'modern-portrait',
          backgroundImageUrl: 'https://cdn.example.com/campaign-backgrounds/user-1/bg.jpg',
        },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/campaigns'));
  });

  it('reports a friendly error and stays on the page when the upload fails', async () => {
    const failure = new Error('upload failed');
    mockUpload.mockRejectedValue(failure);
    renderWithProviders(<NewCampaignPage />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }));

    await waitFor(() =>
      expect(mockReportCampaignError).toHaveBeenCalledWith(failure, 'Không thể tạo chiến dịch. Vui lòng thử lại.'),
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
