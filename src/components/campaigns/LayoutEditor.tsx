import { ColorPicker, Segmented } from 'antd';
import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import PrintArea from '../PrintArea';
import type { AvatarShape, Box, CampaignLayout } from '../../templates/types';
import { clampBoxToCanvas } from './layoutBoxMath';

type BoxKey = 'avatarBox' | 'nameBox' | 'roleBox' | 'messageBox';

const BOX_KEYS: BoxKey[] = ['avatarBox', 'nameBox', 'roleBox', 'messageBox'];

const PLACEHOLDER_CONTENT = {
  avatar: 'https://placehold.co/300x300?text=Avatar',
  fullName: 'Nguyễn Văn A',
  role: 'Đơn vị / Chức vụ',
  message: 'Thông điệp gửi đến đại hội',
};

type LayoutEditorProps = {
  layout: CampaignLayout;
  backgroundImageUrl: string;
  onChange: (layout: CampaignLayout) => void;
};

/**
 * The free-form drag-and-drop layout editor (docs/specs/free-form-layout-editor.md).
 *
 * `PrintArea` (unchanged) stays the single visual source of truth — the
 * same component used for the real preview and final export. A transparent
 * `react-konva` `Stage` sits on top of it at the exact same size, rendering
 * only the four draggable/resizable box outlines (no background/content of
 * their own) — so what's visible under the drag handles, at every frame, is
 * `PrintArea`'s real render, not a separate canvas-drawn copy of it.
 */
export function LayoutEditor({ layout, backgroundImageUrl, onChange }: LayoutEditorProps) {
  const [selected, setSelected] = useState<BoxKey | null>(null);
  const shapeRefs = useRef<Partial<Record<BoxKey, Konva.Rect>>>({});
  const transformerRef = useRef<Konva.Transformer>(null);

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
    <div className="flex flex-col gap-4">
      <div className="relative" style={{ width: layout.canvas.width, height: layout.canvas.height }}>
        <PrintArea
          isDevMod
          template={{
            id: 'campaign-layout',
            name: 'Bố cục chiến dịch',
            description: '',
            background: backgroundImageUrl,
            ...layout,
          }}
          content={PLACEHOLDER_CONTENT}
        />
        <Stage
          width={layout.canvas.width}
          height={layout.canvas.height}
          className="absolute left-0 top-0"
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) setSelected(null);
          }}
        >
          <Layer>
            {BOX_KEYS.map((key) => {
              const box = layout[key];
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
                  fill="rgba(22, 119, 255, 0.08)"
                  stroke={selected === key ? '#1677ff' : 'rgba(22, 119, 255, 0.6)'}
                  strokeWidth={2}
                  draggable
                  onClick={() => setSelected(key)}
                  onTap={() => setSelected(key)}
                  dragBoundFunc={(pos) => {
                    const clamped = clampBoxToCanvas({ ...box, left: pos.x, top: pos.y }, layout.canvas);
                    return { x: clamped.left, y: clamped.top };
                  }}
                  onDragEnd={(event) => {
                    updateBox(key, { ...box, left: event.target.x(), top: event.target.y() });
                  }}
                  onTransformEnd={(event) => {
                    const node = event.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    // Konva expresses a resize as a scale factor on the node
                    // rather than new width/height — reset the scale back to
                    // 1 and fold it into width/height instead, so the stored
                    // box config stays plain pixels, consistent with every
                    // other box in this codebase.
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

      {selected === 'avatarBox' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Hình dạng ảnh đại diện</span>
          <Segmented
            value={layout.avatarBox.shape}
            onChange={(value) => setAvatarShape(value as AvatarShape)}
            options={[
              { label: 'Tròn', value: 'circle' },
              { label: 'Vuông', value: 'square' },
            ]}
          />
        </div>
      )}

      {selected && selected !== 'avatarBox' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Màu chữ</span>
          <ColorPicker
            value={layout[selected].textColor}
            onChangeComplete={(color) => setTextColor(selected, color.toHexString())}
          />
        </div>
      )}
    </div>
  );
}
