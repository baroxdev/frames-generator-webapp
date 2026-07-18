import { z } from 'zod';

// Mirrors the CHECK constraints on `public.submissions`
// (supabase/migrations/0003_submissions.sql) and the duplicated constants in
// supabase/functions/submit-tribute/index.ts — kept in sync by hand since
// each runs in a different language/runtime (same pattern as
// campaign.schema.ts's SLUG_PATTERN comment). These also replace the
// duplicated, slightly-buggy limits previously inlined in App.tsx (its
// fullName error text said "tối đa 45" while the actual check was >25 —
// not preserved here).
export const submissionSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ và tên cần có ít nhất 2 ký tự').max(25, 'Họ và tên tối đa 25 ký tự'),
  role: z.string().trim().min(3, 'Đơn vị cần có ít nhất 3 ký tự').max(36, 'Đơn vị tối đa 36 ký tự'),
  message: z.string().trim().min(10, 'Thông điệp cần có ít nhất 10 ký tự').max(400, 'Thông điệp tối đa 400 ký tự'),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
