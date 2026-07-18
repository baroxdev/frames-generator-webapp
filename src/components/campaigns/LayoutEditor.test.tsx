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
// onTransform handlers to run unmodified.
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
  Rect: ({
    name,
    x,
    y,
    onClick,
    onDragMove,
  }: {
    name: string;
    x: number;
    y: number;
    onClick?: () => void;
    onDragMove?: (e: { target: { x: () => number; y: () => number } }) => void;
  }) => (
    <div>
      <button type="button" data-testid={`konva-rect-${name}`} onClick={onClick}>
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
}));

const LAYOUT = {
  canvas: { width: 1000, height: 500 },
  avatarBox: { top: 50, left: 50, width: 100, height: 100, shape: 'circle' as const },
  nameBox: { top: 300, left: 50, width: 200, height: 40, textColor: '#ffffff' },
  roleBox: { top: 350, left: 50, width: 200, height: 40, textColor: '#ffffff' },
  messageBox: { top: 50, left: 300, width: 600, height: 300, textColor: '#000000' },
};

describe('LayoutEditor', () => {
  it('renders PrintArea with the background and placeholder content at the given layout', () => {
    const { container } = render(
      <LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />,
    );

    expect(container.querySelector('img[src="https://cdn.example.com/bg.jpg"]')).toBeTruthy();
  });

  it('shows no shape/color control until a box is selected', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    expect(screen.queryByText('Hình dạng ảnh đại diện')).toBeNull();
    expect(screen.queryByText('Màu chữ')).toBeNull();
  });

  it('selecting the avatar box shows the circle/square shape picker', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('konva-rect-avatarBox'));

    expect(screen.getByText('Hình dạng ảnh đại diện')).toBeTruthy();
    expect(screen.queryByText('Màu chữ')).toBeNull();
  });

  it('selecting a text box shows the color picker instead of the shape picker', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('konva-rect-messageBox'));

    expect(screen.getByText('Màu chữ')).toBeTruthy();
    expect(screen.queryByText('Hình dạng ảnh đại diện')).toBeNull();
  });

  it('clicking the stage background deselects the current box', () => {
    render(<LayoutEditor layout={LAYOUT} backgroundImageUrl="https://cdn.example.com/bg.jpg" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId('konva-rect-avatarBox'));
    expect(screen.getByText('Hình dạng ảnh đại diện')).toBeTruthy();

    fireEvent.click(screen.getByTestId('konva-stage'));
    expect(screen.queryByText('Hình dạng ảnh đại diện')).toBeNull();
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
});
