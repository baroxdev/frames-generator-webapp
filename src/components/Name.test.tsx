import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Name from './Name';

describe('Name', () => {
  it('applies the given fontFamily as an inline style', () => {
    render(<Name content="Nguyễn Văn A" width={200} height={40} x={0} y={0} fontFamily="Playfair Display" />);

    const nameEl = screen.getByText('Nguyễn Văn A');
    expect(nameEl.style.fontFamily).toBe('"Playfair Display", serif');
  });

  it('falls back to the house default font when fontFamily is omitted', () => {
    render(<Name content="Nguyễn Văn A" width={200} height={40} x={0} y={0} />);

    const nameEl = screen.getByText('Nguyễn Văn A');
    expect(nameEl.style.fontFamily).toBe('"Be Vietnam Pro", sans-serif');
  });
});
