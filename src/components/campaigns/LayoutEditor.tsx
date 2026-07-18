import { ColorPicker, Segmented } from 'antd';
import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { useHtmlImage } from '../../hooks/useHtmlImage';
import type { AvatarShape, Box, CampaignLayout } from '../../templates/types';
import { clampBoxToCanvas } from './layoutBoxMath';

type BoxKey = 'avatarBox' | 'nameBox' | 'roleBox' | 'messageBox';

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
 * actual visitor-facing campaign page and export pipeline. This trades away
 * exact font/style fidelity in the editor's preview (its placeholders are
 * plain Konva text, not the real `Name`/`Role`/`Message` components) in
 * exchange for a single, consistently-behaved rendering/interaction layer;
 * closing that visual gap is a follow-up, not solved here.
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

  const setTextColor = (key: Exclude<BoxKey, 'avatarBox'>, textColor: string) => {
    onChange({ ...layout, [key]: { ...layout[key], textColor } });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div ref={containerRef} className="min-w-0 flex-1">
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
              return (
                <Text
                  key={`${key}-label`}
                  x={box.left}
                  y={box.top}
                  width={box.width}
                  height={box.height}
                  text={PLACEHOLDER_LABEL[key]}
                  fontSize={Math.max(12, Math.min(box.height * 0.3, 32))}
                  fill={isAvatar ? '#334155' : (layout[key] as { textColor?: string }).textColor ?? '#334155'}
                  align="center"
                  verticalAlign="middle"
                  padding={4}
                  wrap="word"
                  listening={false}
                />
              );
            })}

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

            {selected !== 'avatarBox' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-500">Màu chữ</span>
                <ColorPicker
                  value={layout[selected].textColor}
                  onChangeComplete={(color) => setTextColor(selected, color.toHexString())}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
