import { DeleteOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Button, Modal, Popconfirm, Progress, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { useAuthSession } from '../../hooks/useAuthSession';
import { campaignKeys, campaignsQueryOptions } from '../../queries/campaign.queries';
import { deleteSubmissionMutationOptions, submissionKeys, submissionsByCampaignQueryOptions } from '../../queries/submission.queries';
import type { Submission } from '../../services/submission.service';
import { downloadSubmissionsAsZip, IMAGES_PER_ZIP_PART, type DownloadProgress } from '../../utils/downloadSubmissionsAsZip';
import { exportSubmissionsToExcel } from '../../utils/exportSubmissionsToExcel';
import { reportSubmissionError } from '../../utils/report-submission-error';

// Mirrors the authoritative cap enforced by create_submission
// (supabase/migrations/0003_submissions.sql) — see that file's comment for
// why this can only ever be a display value, never enforcement.
const SUBMISSION_CAP = 5000;

function submissionColumns(onDelete: (submission: Submission) => void, isDeleting: boolean): ColumnsType<Submission> {
  return [
    {
      title: 'Ảnh',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      render: (imageUrl: string) => <Avatar shape="square" size={48} src={imageUrl} />,
    },
    { title: 'Họ và tên', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Đơn vị', dataIndex: 'role', key: 'role' },
    {
      title: 'Thông điệp',
      dataIndex: 'message',
      key: 'message',
      render: (text: string) => (
        <Tooltip title={text}>
          <span className="line-clamp-2 max-w-xs">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Thời gian gửi',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString('vi-VN'),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, submission: Submission) => (
        <Popconfirm
          title="Xoá thông điệp này?"
          description="Ảnh đại diện đính kèm cũng sẽ bị xoá. Hành động này không thể hoàn tác."
          okText="Xoá"
          cancelText="Huỷ"
          okButtonProps={{ danger: true, loading: isDeleting }}
          onConfirm={() => onDelete(submission)}
        >
          <Button danger type="text" icon={<DeleteOutlined />} aria-label="Xoá thông điệp" />
        </Popconfirm>
      ),
    },
  ];
}

/**
 * Owner's private submissions dashboard for one campaign (ticket #7): full
 * submission list, the count against the 5,000 cap, per-submission delete,
 * plus the export-to-Excel and download-all-as-zip actions the ticket's
 * addendum asked for.
 *
 * Reuses `campaignsQueryOptions()` to resolve `:id` -> campaign, same as
 * `EditCampaignLayoutPage` — see that page's comment for why this doesn't
 * add a dedicated get-by-id service method.
 */
export function CampaignSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: isSessionLoading } = useAuthSession();
  const queryClient = useQueryClient();

  const [zipProgress, setZipProgress] = useState<DownloadProgress | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const campaignsQuery = useQuery({ ...campaignsQueryOptions(), enabled: Boolean(user) });
  const campaign = campaignsQuery.data?.find((candidate) => candidate.id === id);

  const submissionsQuery = useQuery({
    ...submissionsByCampaignQueryOptions(id ?? ''),
    enabled: Boolean(user) && Boolean(id),
  });

  const deleteMutation = useMutation(deleteSubmissionMutationOptions());

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
      await queryClient.invalidateQueries({ queryKey: submissionKeys.listByCampaign(campaign.id) });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
      message.success('Đã xoá thông điệp.');
    } catch (error) {
      reportSubmissionError(error, 'Không thể xoá thông điệp. Vui lòng thử lại.');
    }
  };

  const handleExportExcel = () => {
    if (submissions.length === 0) return;
    exportSubmissionsToExcel(submissions, `submissions-${campaign.slug}.xlsx`);
  };

  const handleDownloadZip = async () => {
    if (submissions.length === 0) return;
    // Warned up front, not just once mid-download: a multi-part zip fires
    // several automatic saveAs() calls in a row, which browsers can start
    // silently blocking after the first couple — see
    // downloadSubmissionsAsZip.ts's SAVE_GAP_MS comment. There's no
    // client-side fix for that, only this heads-up so the owner knows to
    // allow the browser's "multiple downloads" prompt if it appears.
    if (submissions.length > IMAGES_PER_ZIP_PART) {
      message.info('Sẽ tải nhiều tệp .zip liên tiếp — vui lòng cho phép trình duyệt tải nhiều tệp nếu được hỏi.', 6);
    }
    setIsZipping(true);
    setZipProgress({ completed: 0, total: submissions.length, failed: 0, part: 1, totalParts: 1 });
    try {
      const { failed } = await downloadSubmissionsAsZip(submissions, campaign.slug, setZipProgress);
      if (failed > 0) {
        message.warning(`Đã tải xong, nhưng ${failed} ảnh không tải được.`);
      } else {
        message.success('Đã tải xong toàn bộ ảnh.');
      }
    } catch (error) {
      reportSubmissionError(error, 'Không thể tải ảnh. Vui lòng thử lại.');
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  return (
    <OwnerLayout title="Lượt gửi">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-700">/{campaign.slug}</h3>
            <Tag color={campaign.submissionCount >= SUBMISSION_CAP ? 'red' : 'blue'}>
              {campaign.submissionCount} / {SUBMISSION_CAP}
            </Tag>
          </div>
          <div className="flex gap-2">
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} disabled={submissions.length === 0}>
              Xuất Excel
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadZip}
              loading={isZipping}
              disabled={submissions.length === 0}
            >
              Tải tất cả ảnh (.zip)
            </Button>
          </div>
        </div>

        {submissionsQuery.isError && (
          <Alert type="error" showIcon message="Không thể tải danh sách thông điệp. Vui lòng thử lại." />
        )}

        <Table<Submission>
          rowKey="id"
          columns={submissionColumns(handleDelete, deleteMutation.isPending)}
          dataSource={submissions}
          loading={submissionsQuery.isLoading}
          locale={{ emptyText: 'Chưa có thông điệp nào.' }}
        />
      </div>

      <Modal
        open={isZipping}
        title="Đang tải ảnh..."
        footer={null}
        closable={false}
        mask={{ closable: false }}
      >
        <Progress
          percent={zipProgress ? Math.round((zipProgress.completed / Math.max(zipProgress.total, 1)) * 100) : 0}
        />
        {zipProgress && (
          <p className="mt-2 text-sm text-slate-500">
            {zipProgress.completed} / {zipProgress.total}
            {zipProgress.totalParts > 1 ? ` — tệp ${zipProgress.part}/${zipProgress.totalParts}` : ''}
            {zipProgress.failed > 0 ? ` (${zipProgress.failed} lỗi)` : ''}
          </p>
        )}
      </Modal>
    </OwnerLayout>
  );
}
