import { ColorPicker, Segmented } from 'antd';
import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Shape, Stage, Text, Transformer } from 'react-konva';
import { useHtmlImage } from '../../hooks/useHtmlImage';
import { buildChordSegment, pointOnCircle, type ChordClipAxis } from '../../utils/circleClip';
import { fitTextFontSize } from '../../utils/fitTextToBox';
import { measureTextWidth } from '../../utils/measureText';
import { fontAtSize, MESSAGE_FONT_TEMPLATE, NAME_ROLE_FONT_TEMPLATE } from '../../utils/textFonts';
import type { AvatarShape, Box, CampaignLayout } from '../../templates/types';
import { clampBoxToCanvas } from './layoutBoxMath';

// Thickness (canvas px, unaffected by the Stage's on-screen `scale`) of the
// draggable crop-line bar — a full-width/height strip rather than a thin
// line, so it stays a comfortable drag target even on a resized-down stage.
const CROP_BAR_THICKNESS = 14;

type BoxKey = 'avatarBox' | 'nameBox' | 'roleBox' | 'messageBox';
type TextBoxKey = Exclude<BoxKey, 'avatarBox'>;

const BOX_KEYS: BoxKey[] = ['avatarBox', 'nameBox', 'roleBox', 'messageBox'];

const PLACEHOLDER_LABEL: Record<BoxKey, string> = {
  avatarBox: 'Ảnh đại diện',
  nameBox: 'Nguyễn Văn A',
  roleBox: 'Đơn vị / Chức vụ',
  messageBox: 'Thông điệp gửi đến đại hội',
};

/** Property-panel heading per box — distinct from `PLACEHOLDER_LABEL`, which is the on-canvas sample content. */
const BOX_TITLE: Record<BoxKey, string> = {
  avatarBox: 'Ảnh đại diện',
  nameBox: 'Họ và tên',
  roleBox: 'Đơn vị / Chức vụ',
  messageBox: 'Thông điệp',
};

const FONT_TEMPLATE: Record<TextBoxKey, string> = {
  nameBox: NAME_ROLE_FONT_TEMPLATE,
  roleBox: NAME_ROLE_FONT_TEMPLATE,
  messageBox: MESSAGE_FONT_TEMPLATE,
};

// Mirrors Message.tsx's own cap — however large the message box is, the
// preview shouldn't suggest text bigger than what production will ever
// actually render.
const MAX_MESSAGE_FONT_SIZE = 150;

type LayoutEditorProps = {
  layout: CampaignLayout;
  backgroundImageUrl: string;
  onChange: (layout: CampaignLayout) => void;
};

/**
 * The free-form drag-and-drop layout editor
 * (docs/specs/free-form-layout-editor.md).
 *
 * Rendered entirely in Konva (background image + a placeholder box per
 * field) rather than the DOM/CSS `PrintArea` component — an earlier
 * PrintArea-underneath + transparent-Konva-overlay hybrid didn't hold up in
 * practice (see PR discussion), and `PrintArea` stays reserved for the
 * actual visitor-facing campaign page and export pipeline.
 *
 * Text box labels use the same `fitTextFontSize`/`measureTextWidth`
 * machinery as the real `Name`/`Role`/`Message` components (see
 * `src/utils/textFonts.ts`), so sizing behaves consistently between this
 * preview and production even though the rendering technology (canvas vs.
 * DOM) differs.
 *
 * Fits the canvas to the available container width by scaling the `Stage`
 * itself (`scaleX`/`scaleY`) rather than transforming a wrapper div — Konva
 * accounts for its own scale when mapping pointer coordinates, so drag/
 * resize math below stays in plain, unscaled canvas-pixel space regardless
 * of how small the stage is drawn on screen.
 */
export function LayoutEditor({ layout, backgroundImageUrl, onChange }: LayoutEditorProps) {
  const [selected, setSelected] = useState<BoxKey | null>(null);
  const shapeRefs = useRef<Partial<Record<BoxKey, Konva.Rect>>>({});
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Ephemeral, preview-only sample text per text box — double-click a box
  // to edit it, purely to see how auto-fit sizing behaves for a shorter or
  // longer sample than the default placeholder. Never sent to `onChange`:
  // `CampaignLayout` only ever stores box position/size/shape/color, never
  // content (see docs/specs/free-form-layout-editor.md).
  const [previewText, setPreviewText] = useState<Partial<Record<TextBoxKey, string>>>({});
  const [editingKey, setEditingKey] = useState<TextBoxKey | null>(null);
  const [draftText, setDraftText] = useState('');

  const backgroundImage = useHtmlImage(backgroundImageUrl);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(width / layout.canvas.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout.canvas.width]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selected ? shapeRefs.current[selected] : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selected]);

  const updateBox = (key: BoxKey, box: Box) => {
    onChange({ ...layout, [key]: { ...layout[key], ...clampBoxToCanvas(box, layout.canvas) } });
  };

  const setAvatarShape = (shape: AvatarShape) => {
    onChange({ ...layout, avatarBox: { ...layout.avatarBox, shape } });
  };

  // Switching into crop mode (from "no clip") starts at an exact half —
  // the most useful starting point to drag from in either direction.
  const setClipAxis = (clipAxis: ChordClipAxis | null) => {
    onChange({
      ...layout,
      avatarBox: {
        ...layout.avatarBox,
        clipAxis: clipAxis ?? undefined,
        clipRatio: clipAxis ? layout.avatarBox.clipRatio ?? 0.5 : undefined,
        clipKeepEnd: clipAxis ? layout.avatarBox.clipKeepEnd ?? false : undefined,
      },
    });
  };

  const setClipRatio = (clipRatio: number) => {
    onChange({ ...layout, avatarBox: { ...layout.avatarBox, clipRatio } });
  };

  const flipClipSide = () => {
    onChange({ ...layout, avatarBox: { ...layout.avatarBox, clipKeepEnd: !layout.avatarBox.clipKeepEnd } });
  };

  const setTextColor = (key: TextBoxKey, textColor: string) => {
    onChange({ ...layout, [key]: { ...layout[key], textColor } });
  };

  const startEditing = (key: TextBoxKey) => {
    setSelected(key);
    setEditingKey(key);
    setDraftText(previewText[key] ?? PLACEHOLDER_LABEL[key]);
  };

  const commitEditing = () => {
    if (editingKey) {
      setPreviewText((previous) => ({ ...previous, [editingKey]: draftText.trim() || PLACEHOLDER_LABEL[editingKey] }));
    }
    setEditingKey(null);
  };

  const cancelEditing = () => setEditingKey(null);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div ref={containerRef} className="relative min-w-0 flex-1">
        <Stage
          width={layout.canvas.width * scale}
          height={layout.canvas.height * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) setSelected(null);
          }}
        >
          <Layer>
            {backgroundImage && (
              <KonvaImage
                image={backgroundImage}
                x={0}
                y={0}
                width={layout.canvas.width}
                height={layout.canvas.height}
                listening={false}
              />
            )}

            {BOX_KEYS.map((key) => {
              const box = layout[key];
              const isAvatar = key === 'avatarBox';
              const cornerRadius = isAvatar && layout.avatarBox.shape === 'circle'
                ? Math.min(box.width, box.height) / 2
                : 0;

              return (
                <Rect
                  key={key}
                  name={key}
                  ref={(node) => {
                    if (node) shapeRefs.current[key] = node;
                  }}
                  x={box.left}
                  y={box.top}
                  width={box.width}
                  height={box.height}
                  cornerRadius={cornerRadius}
                  fill={isAvatar ? 'rgba(100, 116, 139, 0.25)' : 'rgba(22, 119, 255, 0.12)'}
                  stroke={selected === key ? '#1677ff' : 'rgba(22, 119, 255, 0.6)'}
                  strokeWidth={2}
                  draggable
                  onClick={() => setSelected(key)}
                  onTap={() => setSelected(key)}
                  onDblClick={() => !isAvatar && startEditing(key as TextBoxKey)}
                  onDblTap={() => !isAvatar && startEditing(key as TextBoxKey)}
                  dragBoundFunc={(pos) => {
                    const clamped = clampBoxToCanvas({ ...box, left: pos.x, top: pos.y }, layout.canvas);
                    return { x: clamped.left, y: clamped.top };
                  }}
                  // Fires on every drag/resize frame, not just on release,
                  // so the box (and its label) tracks the pointer live.
                  onDragMove={(event) => {
                    updateBox(key, { ...box, left: event.target.x(), top: event.target.y() });
                  }}
                  onTransform={(event) => {
                    const node = event.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    // Konva expresses a resize as a scale factor on the node
                    // rather than new width/height — reset the scale back to
                    // 1 on every frame and fold it into width/height instead,
                    // so the stored box config stays plain pixels (consistent
                    // with every other box in this codebase) and the node
                    // never double-applies the same resize as both a scale
                    // and a width/height change on the next render.
                    node.scaleX(1);
                    node.scaleY(1);
                    updateBox(key, {
                      left: node.x(),
                      top: node.y(),
                      width: node.width() * scaleX,
                      height: node.height() * scaleY,
                    });
                  }}
                />
              );
            })}

            {BOX_KEYS.map((key) => {
              const box = layout[key];
              const isAvatar = key === 'avatarBox';
              // Hide the label while its own textarea overlay is open —
              // otherwise the stale Konva-drawn text shows through beneath
              // the (semi-transparent) box while typing.
              if (editingKey === key) return null;

              const text = isAvatar ? PLACEHOLDER_LABEL[key] : previewText[key as TextBoxKey] ?? PLACEHOLDER_LABEL[key];
              const fontSize = isAvatar
                ? Math.max(12, Math.min(box.height * 0.3, 32))
                : fitTextFontSize({
                    text,
                    box,
                    multiline: key === 'messageBox',
                    maxFontSize: key === 'messageBox' ? MAX_MESSAGE_FONT_SIZE : undefined,
                    measure: (measuredText, sizePx) =>
                      measureTextWidth(measuredText, fontAtSize(FONT_TEMPLATE[key as TextBoxKey], sizePx)),
                  });

              return (
                <Text
                  key={`${key}-label`}
                  x={box.left}
                  y={box.top}
                  width={box.width}
                  height={box.height}
                  text={text}
                  fontSize={fontSize}
                  fill={isAvatar ? '#334155' : (layout[key] as { textColor?: string }).textColor ?? '#334155'}
                  align="center"
                  verticalAlign="middle"
                  padding={4}
                  wrap="word"
                  listening={false}
                />
              );
            })}

            {selected === 'avatarBox' && layout.avatarBox.shape === 'circle' && layout.avatarBox.clipAxis && (() => {
              const box = layout.avatarBox;
              const axis = box.clipAxis!;
              const ratio = box.clipRatio ?? 0.5;
              const keepEnd = box.clipKeepEnd ?? false;
              const segment = buildChordSegment(box.width, box.height, axis, ratio, keepEnd);
              const steps = Math.max(2, Math.round(segment.sweep / 4));
              const { radius } = segment;
              const centerX = box.width / 2;
              const centerY = box.height / 2;

              // The bar's own center line — for a horizontal cut this is the
              // (shared) y of both chord endpoints; for a vertical cut, the
              // shared x. Dragging the bar only ever moves along this one
              // axis, and only across the circle's own diameter — not the
              // full box, which can be non-square (the circle is inscribed
              // in the smaller dimension).
              const lineY = segment.start.y;
              const lineX = segment.start.x;

              return (
                <>
                  {/* Kept-region overlay: the arc between the two chord
                      endpoints, closed back to the start with a straight
                      line (the cut itself) — a true half-moon/segment, never
                      a wedge through the center. */}
                  <Shape
                    x={box.left}
                    y={box.top}
                    listening={false}
                    fill="rgba(37, 99, 235, 0.35)"
                    sceneFunc={(context, shape) => {
                      context.beginPath();
                      context.moveTo(segment.start.x, segment.start.y);
                      for (let i = 1; i <= steps; i += 1) {
                        const angle = segment.startAngle + (segment.sweep * i) / steps;
                        const point = pointOnCircle(box.width, box.height, angle);
                        context.lineTo(point.x, point.y);
                      }
                      context.closePath();
                      context.fillStrokeShape(shape);
                    }}
                  />

                  {/* Draggable crop bar — a full-width (horizontal cut) or
                      full-height (vertical cut) strip constrained to move
                      along only that one axis; its position maps directly
                      to `clipRatio`. */}
                  {axis === 'horizontal' ? (
                    <Rect
                      x={box.left}
                      y={box.top + lineY - CROP_BAR_THICKNESS / 2}
                      width={box.width}
                      height={CROP_BAR_THICKNESS}
                      fill="rgba(37, 99, 235, 0.25)"
                      stroke="#2563eb"
                      strokeWidth={2}
                      draggable
                      dragBoundFunc={(pos) => {
                        const minY = box.top + centerY - radius - CROP_BAR_THICKNESS / 2;
                        const maxY = box.top + centerY + radius - CROP_BAR_THICKNESS / 2;
                        return { x: box.left, y: Math.max(minY, Math.min(maxY, pos.y)) };
                      }}
                      onDragMove={(event) => {
                        const newLineY = event.target.y() + CROP_BAR_THICKNESS / 2 - box.top;
                        const newRatio = (newLineY - centerY) / (2 * radius) + 0.5;
                        setClipRatio(Math.max(0, Math.min(1, newRatio)));
                      }}
                    />
                  ) : (
                    <Rect
                      x={box.left + lineX - CROP_BAR_THICKNESS / 2}
                      y={box.top}
                      width={CROP_BAR_THICKNESS}
                      height={box.height}
                      fill="rgba(37, 99, 235, 0.25)"
                      stroke="#2563eb"
                      strokeWidth={2}
                      draggable
                      dragBoundFunc={(pos) => {
                        const minX = box.left + centerX - radius - CROP_BAR_THICKNESS / 2;
                        const maxX = box.left + centerX + radius - CROP_BAR_THICKNESS / 2;
                        return { x: Math.max(minX, Math.min(maxX, pos.x)), y: box.top };
                      }}
                      onDragMove={(event) => {
                        const newLineX = event.target.x() + CROP_BAR_THICKNESS / 2 - box.left;
                        const newRatio = (newLineX - centerX) / (2 * radius) + 0.5;
                        setClipRatio(Math.max(0, Math.min(1, newRatio)));
                      }}
                    />
                  )}
                </>
              );
            })()}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              boundBoxFunc={(_oldBox, newBox) => {
                const clamped = clampBoxToCanvas(
                  { top: newBox.y, left: newBox.x, width: newBox.width, height: newBox.height },
                  layout.canvas,
                );
                return { ...newBox, x: clamped.left, y: clamped.top, width: clamped.width, height: clamped.height };
              }}
            />
          </Layer>
        </Stage>

        {editingKey && (
          <textarea
            autoFocus
            data-testid="preview-text-editor"
            className="absolute resize-none border-2 border-blue-500 bg-white/90 p-1 outline-none"
            style={{
              left: layout[editingKey].left * scale,
              top: layout[editingKey].top * scale,
              width: layout[editingKey].width * scale,
              height: layout[editingKey].height * scale,
              fontSize: 14,
            }}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onBlur={commitEditing}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditing();
              } else if (event.key === 'Enter' && !event.shiftKey && editingKey !== 'messageBox') {
                event.preventDefault();
                commitEditing();
              }
            }}
          />
        )}
      </div>

      {/* Properties sidebar, mirroring how design tools (Figma, etc.) show
          contextual controls for whatever's currently selected, rather than
          inline controls that shift the canvas around as selection changes. */}
      <div className="w-full shrink-0 rounded-md border border-slate-200 p-4 lg:w-56">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Thuộc tính</h4>

        {!selected && <p className="text-sm text-slate-400">Chọn một ô trên ảnh để chỉnh sửa.</p>}

        {selected && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-600">{BOX_TITLE[selected]}</p>

            {selected === 'avatarBox' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-500">Hình dạng</span>
                <Segmented
                  block
                  value={layout.avatarBox.shape}
                  onChange={(value) => setAvatarShape(value as AvatarShape)}
                  options={[
                    { label: 'Tròn', value: 'circle' },
                    { label: 'Vuông', value: 'square' },
                  ]}
                />
              </div>
            )}

            {selected === 'avatarBox' && layout.avatarBox.shape === 'circle' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-500">Cắt hình tròn</span>
                <Segmented
                  block
                  value={layout.avatarBox.clipAxis ?? 'none'}
                  onChange={(value) => setClipAxis(value === 'none' ? null : (value as ChordClipAxis))}
                  options={[
                    { label: 'Tròn đầy', value: 'none' },
                    { label: 'Ngang', value: 'horizontal' },
                    { label: 'Dọc', value: 'vertical' },
                  ]}
                />
                {layout.avatarBox.clipAxis && (
                  <>
                    <p className="text-xs text-slate-400">
                      Kéo thanh xanh trên hình để chọn phần ảnh giữ lại.
                    </p>
                    <button
                      type="button"
                      className="self-start text-xs text-blue-600 underline"
                      onClick={flipClipSide}
                    >
                      Đổi phía giữ lại
                    </button>
                  </>
                )}
              </div>
            )}

            {selected !== 'avatarBox' && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-slate-500">Màu chữ</span>
                  <ColorPicker
                    value={layout[selected].textColor}
                    onChangeComplete={(color) => setTextColor(selected, color.toHexString())}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Cỡ chữ tự động vừa khít theo kích thước ô. Nhấp đúp vào ô trên ảnh để thử với nội dung mẫu khác.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
