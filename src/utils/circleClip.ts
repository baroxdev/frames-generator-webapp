/**
 * Shared angle convention for circle-clip math: degrees, `0` = 12 o'clock,
 * increasing clockwise. Used by both `buildChordClipPath` (the CSS
 * `clip-path` the real avatar renders with) and the free-form layout
 * editor's drag handle (a Konva canvas, not CSS) so the two stay in visual
 * agreement.
 */
export function pointOnCircle(width: number, height: number, angleDeg: number): { x: number; y: number } {
  const radius = Math.min(width, height) / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: centerX + radius * Math.cos(rad), y: centerY + radius * Math.sin(rad) };
}

/** Inverse of `pointOnCircle`: the angle (0-360, same convention) a point around the box's center sits at. */
export function angleFromPoint(width: number, height: number, x: number, y: number): number {
  const centerX = width / 2;
  const centerY = height / 2;
  const deg = (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}

export type ChordClipAxis = 'horizontal' | 'vertical';

interface ChordSegment {
  radius: number;
  /** Where the straight cut line meets the circle, in box-local pixels. */
  start: { x: number; y: number };
  end: { x: number; y: number };
  /** Degrees (see `pointOnCircle`) of `start`/`end`, and the clockwise sweep from one to the other. */
  startAngle: number;
  endAngle: number;
  sweep: number;
}

/**
 * Geometry for a single straight (horizontal or vertical) cut through a
 * circle — a "crop" cut, not a pie wedge: this keeps one whole side of the
 * circle (a half, a sliver, or nearly the whole thing), never a slice out of
 * the middle.
 *
 * `ratio` (0-1) is the cut line's position: for `horizontal`, `0` puts the
 * line at the circle's top edge and `1` at its bottom edge (`0.5` = exactly
 * through the center, a true half-circle); for `vertical`, `0` is the left
 * edge and `1` the right edge. `keepEnd` picks which side of that line
 * survives — for `horizontal`, `false` (default) keeps the top, `true` keeps
 * the bottom; for `vertical`, `false` keeps the left, `true` keeps the
 * right.
 *
 * `start`/`end` are ordered so that `M start A r,r 0 <largeArc>,1 end Z`
 * (sweep-flag always `1`, i.e. always clockwise) traces exactly the kept
 * side — the order itself is what selects top-vs-bottom / left-vs-right,
 * not the arc flags.
 */
export function buildChordSegment(
  width: number,
  height: number,
  axis: ChordClipAxis,
  ratio: number,
  keepEnd: boolean,
): ChordSegment {
  const radius = Math.min(width, height) / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const offset = (ratio - 0.5) * 2 * radius;
  const halfChord = Math.sqrt(Math.max(radius * radius - offset * offset, 0));

  let start: { x: number; y: number };
  let end: { x: number; y: number };
  if (axis === 'horizontal') {
    const lineY = centerY + offset;
    const left = { x: centerX - halfChord, y: lineY };
    const right = { x: centerX + halfChord, y: lineY };
    [start, end] = keepEnd ? [right, left] : [left, right];
  } else {
    const lineX = centerX + offset;
    const top = { x: lineX, y: centerY - halfChord };
    const bottom = { x: lineX, y: centerY + halfChord };
    [start, end] = keepEnd ? [top, bottom] : [bottom, top];
  }

  const startAngle = angleFromPoint(width, height, start.x, start.y);
  const endAngle = angleFromPoint(width, height, end.x, end.y);
  const sweep = ((endAngle - startAngle) % 360 + 360) % 360;

  return { radius, start, end, startAngle, endAngle, sweep };
}

/** Builds a `clip-path: path(...)` value for the chord cut described by `buildChordSegment`. */
export function buildChordClipPath(
  width: number,
  height: number,
  axis: ChordClipAxis,
  ratio: number,
  keepEnd: boolean,
): string {
  const { radius, start, end, sweep } = buildChordSegment(width, height, axis, ratio, keepEnd);
  const largeArcFlag = sweep > 180 ? 1 : 0;
  const d = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  return `path('${d}')`;
}
