import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutEditor } from './LayoutEditor';

// react-konva renders to a real <canvas> via Konva, which needs a native
// canvas backend jsdom doesn't provide in this environment (see
// docs/specs/free-form-layout-editor.md's testing note) — so, same pattern
// as CampaignPublicPage.test.tsx stubbing out TributeForm, the Konva
// primitives are mocked at their boundary: each `Rect` becomes a plain
// button carrying its box `name` and exposing just enough of Konva's event
// shape (`event.target.x()`/`y()`) for the component's own onDragMove/
// onTransform handlers to run unmodified. `Image` and `Text` become plain
// DOM stand-ins exposing enough props to assert on.
vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown }: { children: React.ReactNode; onMouseDown?: (e: unknown) => void }) => (
    <div
      data-testid="konva-stage"
      onClick={(event) => {
        // Real Konva only calls onMouseDown with `target === stage` for a
        // click that actually lands on the empty background, not one on a
        // child shape — this mock's div wrapper otherwise has every nested
        // Rect click bubble up to it too, which a real Konva Stage (no DOM
        // bubbling involved) never does.
        if (event.target !== event.currentTarget) return;
        const fakeStage = {};
        Object.assign(fakeStage, { getStage: () => fakeStage });
        onMouseDown?.({ target: fakeStage });
      }}
    >
      {children}
    </div>
  ),
  Layer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Image: ({ image }: { image?: HTMLImageElement }) =>
    image ? <img data-testid="konva-background" src={image.src} alt="" /> : null,
  Text: ({ text, fontSize }: { text: string; fontSize: number }) => (
    <span data-testid="konva-text" data-font-size={fontSize}>
      {text}
    </span>
  ),
  Rect: ({
    name,
    x,
    y,
    onClick,
    onDragMove,
    onDblClick,
  }: {
    name: string;
    x: number;
    y: number;
    onClick?: () => void;
    onDragMove?: (e: { target: { x: () => number; y: () => number } }) => void;
    onDblClick?: () => void;
  }) => (
    <div>
      <button type="button" data-testid={`konva-rect-${name}`} onClick={onClick} onDoubleClick={onDblClick}>
        {name}
      </button>
      <button
        type="button"
        data-testid={`konva-rect-${name}-drag`}
        onClick={() => onDragMove?.({ target: { x: () => x + 500, y: () => y + 500 } })}
      >
        drag {name}
      </button>
    </div>
  ),
  Transformer: () => null,
  // Sector-clip drag handles/wedge overlay (LayoutEditor.tsx) — no test
  // below drives these yet, so a no-op stub is enough to keep the mocked
  // module's shape complete and avoid the "no export defined" crash.
  Circle: () => null,
  Shape: () => null,
}));

// The real hook loads an image asynchronously via `new window.Image()`,
// which jsdom never actually decodes — mocked here so the background
// renders deterministically in tests instead of staying forever unloaded.
vi.mock('../../hooks/useHtmlImage', () => ({
  useHtmlImage: (src: string | undefined) => (src ? ({ src } as HTMLImageElement) : undefined),
}));

const LAYOUT = {
  canvas: { width: 1000, height: 500 },
  avatarBox: { top: 50, left: 50, width: 100, height: 100, shape: 'circle' as const },
  nameBox: { top: 300, left: 50, width: 200, height: 40, textColor: '#ffffff' },
  roleBox: { top: 350, left: 50, width: 200, height: 40, textColor: '#ffffff' },
  messageBox: { top: 50, left: 300, width: 600, height: 300, textColor: '#000000' },
};

describe('LayoutEditor', () => {
  it('renders the background image and a placeholder label per box', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    expect(screen.getByTestId('konva-background').getAttribute('src')).toBe('https://cdn.example.com/bg.jpg');
    // Some placeholder labels (e.g. avatarBox's "Ảnh đại diện") match a
    // BOX_TITLE used again in the sidebar's layers list below, so these
    // are scoped to the Konva-rendered labels specifically rather than
    // `getByText`, which would otherwise find both.
    const labels = screen.getAllByTestId('konva-text').map((node) => node.textContent);
    expect(labels).toEqual(
      expect.arrayContaining(['Ảnh đại diện', 'Nguyễn Văn A', 'Đơn vị / Chức vụ', 'Thông điệp gửi đến đại hội']),
    );
  });

  it('shows a placeholder hint in the properties sidebar until a box is selected', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    expect(screen.getByText('Chọn một lớp bên dưới, hoặc chọn trực tiếp trên ảnh.')).toBeTruthy();
    expect(screen.queryByText('Hình dạng')).toBeNull();
    expect(screen.queryByText('Màu chữ')).toBeNull();
  });

  it('selecting the avatar box shows the circle/square shape picker in the sidebar', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('konva-rect-avatarBox'));

    expect(screen.getByText('Hình dạng')).toBeTruthy();
    expect(screen.queryByText('Màu chữ')).toBeNull();
  });

  it('selecting a text box shows the color picker instead of the shape picker', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('konva-rect-messageBox'));

    expect(screen.getByText('Màu chữ')).toBeTruthy();
    expect(screen.queryByText('Hình dạng')).toBeNull();
  });

  it('clicking the stage background deselects the current box', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('konva-rect-avatarBox'));
    expect(screen.getByText('Hình dạng')).toBeTruthy();

    fireEvent.click(screen.getByTestId('konva-stage'));
    expect(screen.queryByText('Hình dạng')).toBeNull();
    expect(screen.getByText('Chọn một lớp bên dưới, hoặc chọn trực tiếp trên ảnh.')).toBeTruthy();
  });

  it('dragging a box emits an onChange with the new (clamped) position, merged into the full layout', () => {
    const onChange = vi.fn();
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('konva-rect-nameBox-drag'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0];
    // nameBox moved to (550, 550) pre-clamp; canvas is 1000x500 and the box
    // is 200x40, so it must land clamped fully inside (left <= 800, top <= 460).
    expect(updated.nameBox.left).toBeLessThanOrEqual(800);
    expect(updated.nameBox.top).toBeLessThanOrEqual(460);
    expect(updated.nameBox.width).toBe(LAYOUT.nameBox.width);
    // Every other box is untouched.
    expect(updated.avatarBox).toEqual(LAYOUT.avatarBox);
    expect(updated.roleBox).toEqual(LAYOUT.roleBox);
    expect(updated.messageBox).toEqual(LAYOUT.messageBox);
  });

  it('changing the avatar shape emits an onChange with only the shape updated', () => {
    const onChange = vi.fn();
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('konva-rect-avatarBox'));
    fireEvent.click(screen.getByText('Vuông'));

    expect(onChange).toHaveBeenCalledWith({
      ...LAYOUT,
      avatarBox: { ...LAYOUT.avatarBox, shape: 'square' },
    });
  });

  describe('ephemeral preview-text editing (double-click)', () => {
    it('double-clicking a text box opens an editable overlay pre-filled with its current sample text', () => {
      render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

      fireEvent.doubleClick(screen.getByTestId('konva-rect-nameBox'));

      const editor = screen.getByTestId('preview-text-editor') as HTMLTextAreaElement;
      expect(editor.value).toBe('Nguyễn Văn A');
    });

    it('double-clicking the avatar box does nothing (no text content to edit)', () => {
      render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

      fireEvent.doubleClick(screen.getByTestId('konva-rect-avatarBox'));

      expect(screen.queryByTestId('preview-text-editor')).toBeNull();
    });

    it('committing edited text (Enter, for single-line boxes) updates the on-canvas label and never calls onChange', () => {
      const onChange = vi.fn();
      render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={onChange} />);

      fireEvent.doubleClick(screen.getByTestId('konva-rect-nameBox'));
      const editor = screen.getByTestId('preview-text-editor');
      fireEvent.change(editor, { target: { value: 'A Much Longer Sample Name To Test' } });
      fireEvent.keyDown(editor, { key: 'Enter' });

      expect(screen.queryByTestId('preview-text-editor')).toBeNull();
      expect(screen.getByText('A Much Longer Sample Name To Test')).toBeTruthy();
      // Preview text is ephemeral/local only — never persisted to the layout.
      expect(onChange).not.toHaveBeenCalled();
    });

    it('pressing Escape cancels the edit, leaving the original sample text on canvas', () => {
      render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

      fireEvent.doubleClick(screen.getByTestId('konva-rect-roleBox'));
      const editor = screen.getByTestId('preview-text-editor');
      fireEvent.change(editor, { target: { value: 'Something Else Entirely' } });
      fireEvent.keyDown(editor, { key: 'Escape' });

      expect(screen.queryByTestId('preview-text-editor')).toBeNull();
      // "Đơn vị / Chức vụ" is both the roleBox's on-canvas placeholder and
      // the sidebar's box-title heading (same string) — two matches, both
      // unchanged, confirms the cancel left the sample text alone.
      expect(screen.getAllByText('Đơn vị / Chức vụ')).toHaveLength(2);
      expect(screen.queryByText('Something Else Entirely')).toBeNull();
    });

    it('committing via blur works for the message box (Enter alone must not commit, since it should allow multiple lines)', () => {
      render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

      fireEvent.doubleClick(screen.getByTestId('konva-rect-messageBox'));
      const editor = screen.getByTestId('preview-text-editor');
      fireEvent.change(editor, { target: { value: 'A brand new tribute message' } });
      fireEvent.keyDown(editor, { key: 'Enter' });
      expect(screen.getByTestId('preview-text-editor')).toBeTruthy(); // still open

      fireEvent.blur(editor);
      expect(screen.queryByTestId('preview-text-editor')).toBeNull();
      expect(screen.getByText('A brand new tribute message')).toBeTruthy();
    });
  });

  describe('auto-fit font sizing', () => {
    it('gives a longer sample text a smaller (or equal) font size than a shorter one in the same box', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={onChange} />,
      );
      const shortSize = Number(screen.getByText('Nguyễn Văn A').getAttribute('data-font-size'));

      fireEvent.doubleClick(screen.getByTestId('konva-rect-nameBox'));
      fireEvent.change(screen.getByTestId('preview-text-editor'), {
        target: { value: 'A Considerably Longer Full Name Than Before' },
      });
      fireEvent.keyDown(screen.getByTestId('preview-text-editor'), { key: 'Enter' });
      rerender(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={onChange} />);

      const longSize = Number(
        screen.getByText('A Considerably Longer Full Name Than Before').getAttribute('data-font-size'),
      );
      expect(longSize).toBeLessThanOrEqual(shortSize);
    });
  });
});
