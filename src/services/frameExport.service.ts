/**
 * html2canvas rasterizes `cardRef.current` (see `generateDataUrl` in
 * App.tsx) using a *virtual* browser window (`windowWidth`), decoupled from
 * the page's real viewport. Two invariants have to hold for any template's
 * frame to export correctly, and both are why the original App.tsx pinned
 * `windowWidth: 1928` instead of just using the real window width:
 *
 * 1. It must stay comfortably above Tailwind's `md` breakpoint (768px). The
 *    off-screen preview card is wrapped in `max-md:hidden` (see App.tsx);
 *    if html2canvas's virtual window resolved as "mobile", the whole card
 *    would compute `display: none` during capture and produce a blank
 *    export — on an actual narrow phone viewport, not just in theory.
 * 2. It must be at least as wide as the template's canvas, so the
 *    absolutely-positioned avatar/name/role/message boxes never get
 *    clipped or reflowed mid-capture. `CANVAS_CAPTURE_MARGIN` preserves the
 *    same margin the original 1928 used for the 1500px-wide layout
 *    (1928 - 1500 = 428) so today's default template captures at exactly
 *    the same width it always has.
 *
 * `scale: 2` (the other export setting tuned for quality) is independent
 * of canvas width — it's a fixed output pixel-density multiplier, not a
 * layout measurement — so it stays constant across every template and
 * isn't part of this calculation.
 */
const MOBILE_BREAKPOINT_SAFE_WIDTH = 1024; // comfortably above Tailwind's 768px `md` breakpoint
const CANVAS_CAPTURE_MARGIN = 428; // preserves today's 1928 for the 1500px-wide gallery templates

export function getExportWindowWidth(canvasWidth: number): number {
  return Math.max(MOBILE_BREAKPOINT_SAFE_WIDTH, canvasWidth + CANVAS_CAPTURE_MARGIN);
}
