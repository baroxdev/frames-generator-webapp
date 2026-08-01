import { describe, expect, it, vi } from 'vitest';
import type { Submission } from '../services/submission.service';

const aoa_to_sheet = vi.fn().mockReturnValue({});
const book_new = vi.fn().mockReturnValue({});
const book_append_sheet = vi.fn();
const writeFile = vi.fn();

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: (...args: unknown[]) => aoa_to_sheet(...args),
    book_new: (...args: unknown[]) => book_new(...args),
    book_append_sheet: (...args: unknown[]) => book_append_sheet(...args),
  },
  writeFile: (...args: unknown[]) => writeFile(...args),
}));

import { exportSubmissionsToExcel } from './exportSubmissionsToExcel';

const SUBMISSIONS: Submission[] = [
  {
    id: 'submission-1',
    campaignId: 'campaign-1',
    fullName: 'Nguyễn Văn A',
    role: 'Cựu học sinh',
    message: 'Chúc mừng đại hội!',
    imageUrl: 'https://cdn.example.com/submissions/campaign-1/a.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('exportSubmissionsToExcel', () => {
  it('builds a worksheet with a header row plus one row per submission', () => {
    exportSubmissionsToExcel(SUBMISSIONS, 'submissions.xlsx');

    expect(aoa_to_sheet).toHaveBeenCalledWith([
      ['Họ và tên', 'Đơn vị', 'Thông điệp', 'Ảnh', 'Thời gian gửi'],
      [
        'Nguyễn Văn A',
        'Cựu học sinh',
        'Chúc mừng đại hội!',
        'https://cdn.example.com/submissions/campaign-1/a.jpg',
        new Date(SUBMISSIONS[0].createdAt).toLocaleString('vi-VN'),
      ],
    ]);
  });

  it('writes the workbook to the given file name', () => {
    exportSubmissionsToExcel(SUBMISSIONS, 'my-campaign-submissions.xlsx');

    expect(writeFile).toHaveBeenCalledWith(expect.anything(), 'my-campaign-submissions.xlsx');
  });

  it('handles an empty submissions list', () => {
    exportSubmissionsToExcel([], 'empty.xlsx');

    expect(aoa_to_sheet).toHaveBeenCalledWith([['Họ và tên', 'Đơn vị', 'Thông điệp', 'Ảnh', 'Thời gian gửi']]);
  });
});
