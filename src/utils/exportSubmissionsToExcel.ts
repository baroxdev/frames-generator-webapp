import * as XLSX from 'xlsx';
import type { Submission } from '../services/submission.service';

const COLUMN_HEADERS = ['Họ và tên', 'Đơn vị', 'Thông điệp', 'Ảnh', 'Thời gian gửi'] as const;

function toRow(submission: Submission): string[] {
  return [
    submission.fullName,
    submission.role,
    submission.message,
    submission.imageUrl,
    new Date(submission.createdAt).toLocaleString('vi-VN'),
  ];
}

/**
 * Builds and downloads an .xlsx of a campaign's submissions. `xlsx`'s
 * array-of-arrays -> worksheet conversion and `writeFile` are both
 * synchronous, in-memory operations with no per-row network/DOM cost, so
 * this comfortably handles the 2,000+ row campaigns the owner dashboard
 * needs to support (a few thousand short text cells is trivial for
 * SheetJS — the real scale risk in this feature is the image zip download,
 * not this) without any chunking or a worker.
 */
export function exportSubmissionsToExcel(submissions: Submission[], fileName: string): void {
  const worksheet = XLSX.utils.aoa_to_sheet([[...COLUMN_HEADERS], ...submissions.map(toRow)]);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 60 }, { wch: 50 }, { wch: 20 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');
  XLSX.writeFile(workbook, fileName);
}
