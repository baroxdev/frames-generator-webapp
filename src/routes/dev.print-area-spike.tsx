import { createFileRoute } from "@tanstack/react-router";

import { PrintAreaKonvaSpike } from "../pages/dev/PrintAreaKonvaSpike";

// Dev-only comparison page for the PrintArea → Konva spike (rnd/print-area
// branch) — not linked from any real navigation, reachable only by URL.
// `ssr: false` since both renderers (a real DOM node + a Konva canvas) need
// a browser.
export const Route = createFileRoute("/dev/print-area-spike")({
  ssr: false,
  component: PrintAreaKonvaSpike,
});
