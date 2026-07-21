import {
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Image,
  Popconfirm,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Navigate, useParams } from "@tanstack/react-router";
import { OwnerLayout } from "../../components/owner/OwnerLayout";
import { useAuthSession } from "../../hooks/useAuthSession";
import {
  campaignKeys,
  campaignsQueryOptions,
} from "../../queries/campaign.queries";
import {
  deleteSubmissionMutationOptions,
  submissionKeys,
  submissionsByCampaignQueryOptions,
} from "../../queries/submission.queries";
import type { Submission } from "../../services/submission.service";
import { downloadImage } from "../../utils/downloadImage";
import { exportSubmissionsToExcel } from "../../utils/exportSubmissionsToExcel";
import { reportSubmissionError } from "../../utils/report-submission-error";

// Mirrors the authoritative cap enforced by create_submission
// (supabase/migrations/0003_submissions.sql) — see that file's comment for
// why this can only ever be a display value, never enforcement.
const SUBMISSION_CAP = 200000;

function fileNameFor(submission: Submission): string {
  return `${submission.fullName.replace(/[\\/:*?"<>|]/g, "_").trim() || "submission"}-${submission.id.slice(0, 8)}.jpg`;
}

function submissionColumns(
  onDelete: (submission: Submission) => void,
  isDeleting: boolean,
  onDownload: (submission: Submission) => void,
  downloadingId: string | null,
): ColumnsType<Submission> {
  return [
    {
      title: "Ảnh",
      dataIndex: "imageUrl",
      key: "imageUrl",
      // antd's Image has a built-in click-to-zoom preview lightbox — no
      // custom modal needed for "view the full image".
      render: (imageUrl: string) => (
        <Image
          src={imageUrl}
          width={48}
          height={48}
          className="!object-cover"
        />
      ),
    },
    { title: "Họ và tên", dataIndex: "fullName", key: "fullName" },
    { title: "Đơn vị", dataIndex: "role", key: "role" },
    {
      title: "Thông điệp",
      dataIndex: "message",
      key: "message",
      render: (text: string) => (
        <Tooltip title={text}>
          <span className="line-clamp-2 max-w-xs">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: "Thời gian gửi",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt: string) =>
        new Date(createdAt).toLocaleString("vi-VN"),
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, submission: Submission) => (
        <div className="flex gap-1">
          <Button
            type="text"
            icon={<DownloadOutlined />}
            aria-label="Tải ảnh"
            loading={downloadingId === submission.id}
            onClick={() => onDownload(submission)}
          />
          <Popconfirm
            title="Xoá thông điệp này?"
            description="Ảnh đại diện đính kèm cũng sẽ bị xoá. Hành động này không thể hoàn tác."
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true, loading: isDeleting }}
            onConfirm={() => onDelete(submission)}
          >
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              aria-label="Xoá thông điệp"
            />
          </Popconfirm>
        </div>
      ),
    },
  ];
}

/**
 * Owner's private submissions dashboard for one campaign (ticket #7): full
 * submission list, the count against the 5,000 cap, per-submission delete,
 * export-to-Excel, viewing a submission's full image (antd's built-in
 * preview lightbox), and downloading one submission's image at a time.
 *
 * There's deliberately no "download all as zip" bulk action here — an
 * earlier attempt at one (client-side, fetching every image at once) hit
 * Cloudflare R2's public `*.r2.dev` domain rate limit under concurrent
 * bursts, and the server-side alternative (a Cloudflare Worker with an R2
 * binding, streaming a zip) turned out to need the Workers Paid plan to
 * fit a 5,000-image campaign under the subrequest limit. Per-submission
 * download sidesteps all of that: each click is one, user-gestured fetch,
 * never a burst, so it never has to contend with r2.dev's throttling.
 *
 * Reuses `campaignsQueryOptions()` to resolve `:id` -> campaign, same as
 * `EditCampaignPage` — see that page's comment for why this doesn't
 * add a dedicated get-by-id service method.
 */
export function CampaignSubmissionsPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { user, isLoading: isSessionLoading } = useAuthSession();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    ...campaignsQueryOptions(),
    enabled: Boolean(user),
  });
  const campaign = campaignsQuery.data?.find(
    (candidate) => candidate.id === id,
  );

  const submissionsQuery = useQuery({
    ...submissionsByCampaignQueryOptions(id ?? ""),
    enabled: Boolean(user) && Boolean(id),
  });

  const deleteMutation = useMutation(deleteSubmissionMutationOptions());
  const downloadMutation = useMutation({
    mutationFn: (submission: Submission) =>
      downloadImage(submission.imageUrl, fileNameFor(submission)),
  });

  if (isSessionLoading || campaignsQuery.isLoading) {
    return (
      <OwnerLayout title="Lượt gửi">
        <p className="text-center text-gray-500">Đang tải...</p>
      </OwnerLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!campaign) {
    return (
      <OwnerLayout title="Lượt gửi">
        <Alert type="error" showIcon message="Không tìm thấy chiến dịch này." />
      </OwnerLayout>
    );
  }

  const submissions = submissionsQuery.data ?? [];

  const handleDelete = async (submission: Submission) => {
    try {
      await deleteMutation.mutateAsync(submission.id);
      await queryClient.invalidateQueries({
        queryKey: submissionKeys.listByCampaign(campaign.id),
      });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      message.success("Đã xoá thông điệp.");
    } catch (error) {
      reportSubmissionError(
        error,
        "Không thể xoá thông điệp. Vui lòng thử lại.",
      );
    }
  };

  const handleExportExcel = () => {
    if (submissions.length === 0) return;
    exportSubmissionsToExcel(submissions, `submissions-${campaign.slug}.xlsx`);
  };

  const handleDownload = async (submission: Submission) => {
    try {
      await downloadMutation.mutateAsync(submission);
    } catch (error) {
      reportSubmissionError(error, "Không thể tải ảnh. Vui lòng thử lại.");
    }
  };

  return (
    <OwnerLayout title="Lượt gửi">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-700">
              /{campaign.slug}
            </h3>
            <Tag
              color={
                campaign.submissionCount >= SUBMISSION_CAP ? "red" : "blue"
              }
            >
              {campaign.submissionCount} / {SUBMISSION_CAP}
            </Tag>
          </div>
          <div className="flex gap-2">
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              disabled={submissions.length === 0}
            >
              Xuất Excel
            </Button>
          </div>
        </div>

        {submissionsQuery.isError && (
          <Alert
            type="error"
            showIcon
            message="Không thể tải danh sách thông điệp. Vui lòng thử lại."
          />
        )}

        <Table<Submission>
          rowKey="id"
          columns={submissionColumns(
            handleDelete,
            deleteMutation.isPending,
            handleDownload,
            downloadMutation.isPending
              ? (downloadMutation.variables?.id ?? null)
              : null,
          )}
          dataSource={submissions}
          loading={submissionsQuery.isLoading}
          locale={{ emptyText: "Chưa có thông điệp nào." }}
        />
      </div>
    </OwnerLayout>
  );
}
