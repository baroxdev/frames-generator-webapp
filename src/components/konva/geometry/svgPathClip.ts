import Konva from "konva";

/**
 * Replays an SVG path `data` string (as produced by `circleClip.ts`'s
 * chord-clip math, the same string `Avatar.tsx` feeds to CSS
 * `clip-path: path(...)`) as canvas path commands inside a `clipFunc`.
 *
 * Parses via `Konva.Path.parsePathData` — Konva's own public static SVG-path
 * parser — and replays each segment with the exact same command switch
 * `Konva.Path`'s own `_sceneFunc` uses (konvajs/konva `src/shapes/Path.ts`),
 * copied rather than re-derived since it already handles the
 * elliptical-arc math (`A`) the chord-clip path relies on.
 */
export function tracePathData(ctx: Konva.Context, data: string): void {
  const segments = Konva.Path.parsePathData(data);
  ctx.beginPath();
  for (const segment of segments) {
    const p = segment.points;
    switch (segment.command) {
      case "M":
        ctx.moveTo(p[0], p[1]);
        break;
      case "L":
        ctx.lineTo(p[0], p[1]);
        break;
      case "C":
        ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
        break;
      case "Q":
        ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
        break;
      case "A": {
        const [cx, cy, rx, ry, theta, dTheta, psi, fs] = p;
        const r = rx > ry ? rx : ry;
        const scaleX = rx > ry ? 1 : rx / ry;
        const scaleY = rx > ry ? ry / rx : 1;
        ctx.translate(cx, cy);
        ctx.rotate(psi);
        ctx.scale(scaleX, scaleY);
        ctx.arc(0, 0, r, theta, theta + dTheta, Boolean(1 - fs));
        ctx.scale(1 / scaleX, 1 / scaleY);
        ctx.rotate(-psi);
        ctx.translate(-cx, -cy);
        break;
      }
      case "z":
        ctx.closePath();
        break;
    }
  }
}
