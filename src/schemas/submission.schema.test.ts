import { describe, expect, it } from 'vitest';
import { submissionSchema } from './submission.schema';

const VALID_INPUT = {
  fullName: 'Nguyễn Văn A',
  role: 'Cựu học sinh khóa 2010',
  message: 'Chúc mừng đại hội thành công tốt đẹp!',
};

describe('submissionSchema', () => {
  it('accepts valid input', () => {
    expect(submissionSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = submissionSchema.safeParse({ ...VALID_INPUT, fullName: '  Nguyễn Văn A  ' });
    expect(result.success && result.data.fullName).toBe('Nguyễn Văn A');
  });

  it.each([
    ['fullName', 'A'],
    ['fullName', 'A'.repeat(26)],
    ['role', 'AB'],
    ['role', 'A'.repeat(37)],
    ['message', 'short'],
    ['message', 'A'.repeat(401)],
  ])('rejects %s of invalid length', (field, value) => {
    const result = submissionSchema.safeParse({ ...VALID_INPUT, [field]: value });
    expect(result.success).toBe(false);
  });

  it('rejects empty fields', () => {
    const result = submissionSchema.safeParse({ fullName: '', role: '', message: '' });
    expect(result.success).toBe(false);
  });
});
