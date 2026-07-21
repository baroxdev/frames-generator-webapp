import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Name from './Name';
import * as measureTextModule from '../utils/measureText';

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

  it('renders the raw name unchanged when showPrefix is not set', () => {
    render(<Name content="Phan Quốc Bảo" width={200} height={40} x={0} y={0} />);

    expect(screen.queryByText('Họ và tên: Phan Quốc Bảo')).toBeNull();
    expect(screen.getByText('Phan Quốc Bảo')).not.toBeNull();
  });

  it('prepends the fixed "Họ và tên: " prefix when showPrefix is set', () => {
    render(<Name content="Phan Quốc Bảo" width={200} height={40} x={0} y={0} showPrefix />);

    expect(screen.getByText('Họ và tên: Phan Quốc Bảo')).not.toBeNull();
  });

  describe('auto-fit font size vs. font readiness', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      Reflect.deleteProperty(document, 'fonts');
    });

    // Regression test for a campaign's own uploaded (R2-hosted) custom font:
    // the very first auto-fit measurement used to run before that font's
    // glyph file had finished downloading, so `measureTextWidth` silently
    // measured against the browser's fallback font instead — and because
    // nothing ever recomputed afterward, the wrong size stuck for the whole
    // component lifetime (see Name.tsx's `fontReadyGeneration` state).
    it('recomputes the fitted font size once the real font finishes loading, instead of freezing on the fallback metrics', async () => {
      let fontLoaded = false;
      vi.spyOn(measureTextModule, 'measureTextWidth').mockImplementation((text) => {
        const perCharPx = fontLoaded ? 8 : 20;
        return text.length * perCharPx;
      });

      let resolveLoad: (fonts: FontFace[]) => void;
      const loadPromise = new Promise<FontFace[]>((resolve) => {
        resolveLoad = resolve;
      });
      Object.defineProperty(document, 'fonts', {
        value: { load: vi.fn().mockReturnValue(loadPromise) },
        configurable: true,
      });

      const customFont = {
        family: 'custom-name-autofit-test',
        url: 'https://cdn.example.com/campaign-fonts/owner/font.woff2',
        format: 'woff2' as const,
        originalFileName: 'font.woff2',
      };

      render(
        <Name
          content="Nguyễn Văn A"
          width={200}
          height={40}
          x={0}
          y={0}
          autoFit
          fontFamily={customFont.family}
          customFont={customFont}
        />,
      );

      const nameEl = screen.getByText('Nguyễn Văn A');
      const sizeBeforeReady = parseFloat(nameEl.style.fontSize);

      fontLoaded = true;
      await act(async () => {
        resolveLoad([]);
        await loadPromise;
      });

      await waitFor(() => {
        expect(parseFloat(nameEl.style.fontSize)).toBeGreaterThan(sizeBeforeReady);
      });
    });
  });
});
