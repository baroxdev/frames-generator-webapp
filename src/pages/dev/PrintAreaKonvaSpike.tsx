import Konva from "konva";
import { useMemo, useRef, useState } from "react";

import { KonvaPrintArea } from "../../components/KonvaPrintArea";
import PrintArea from "../../components/PrintArea";
import { compositeFrameToBlobKonva } from "../../services/frameCompositor.konva";
import { compositeFrameToBlob } from "../../services/frameCompositor.service";
import { getTemplateGallery } from "../../templates/gallery";
import { FrameContent } from "../../templates/types";

// Keeps both previews at a sane on-screen size regardless of a template's
// actual canvas size (up to 1500px wide in gallery.ts today) — purely a
// display concern, unrelated to either export path's own resolution.
const MAX_DISPLAY_WIDTH = 620;

const DEFAULT_CONTENT: FrameContent = {
  fullName: "Nguyễn Văn An",
  role: "Chủ tịch Hội đồng quản trị",
  message:
    "Xin gửi lời chúc mừng tốt đẹp nhất đến toàn thể đại hội. Chúc đại hội thành công rực rỡ và đạt được nhiều thắng lợi mới.",
};

/**
 * Dev-only spike page (docs/specs or PR description context: rnd/print-area
 * branch) rendering `PrintArea` (DOM/CSS, `modern-screenshot`-exported) and
 * `KonvaPrintArea` (canvas-native) side by side for the same template and
 * content, each with its own export button — so the two can be visually
 * diffed in any browser, and specifically re-checked in Safari where the
 * DOM path is known to sometimes fall back to the wrong font at export time
 * (see `loadGoogleFont.ts`'s doc comment on `injectCustomFontFace`) even
 * though it renders correctly on-screen.
 *
 * Not linked from any real navigation — reachable only at
 * `/dev/print-area-spike` (see `src/routes/dev.print-area-spike.tsx`).
 */
export function PrintAreaKonvaSpike() {
  const templates = useMemo(() => getTemplateGallery(), []);
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [content, setContent] = useState<FrameContent>(DEFAULT_CONTENT);
  const [domExportUrl, setDomExportUrl] = useState<string | null>(null);
  const [konvaExportUrl, setKonvaExportUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"dom" | "konva" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domRef = useRef<HTMLDivElement>(null);
  const konvaStageRef = useRef<Konva.Stage>(null);

  const template = templates.find((candidate) => candidate.id === templateId) ?? templates[0];
  const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / template.canvas.width);

  const handleExportDom = async () => {
    if (!domRef.current) return;
    setExporting("dom");
    setError(null);
    try {
      const blob = await compositeFrameToBlob(domRef.current, template.fontFamily, template.customFont);
      setDomExportUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "DOM export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleExportKonva = async () => {
    if (!konvaStageRef.current) return;
    setExporting("konva");
    setError(null);
    try {
      const blob = await compositeFrameToBlobKonva(
        konvaStageRef.current,
        template.fontFamily,
        template.customFont,
      );
      setKonvaExportUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konva export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">PrintArea: DOM vs Konva spike</h1>
      <p className="text-sm text-slate-500">
        Compare the current DOM/CSS renderer against the Konva prototype for the same template
        and content. Export both and inspect the downloaded images — this is the check that
        matters on Safari, where the DOM path can silently fall back to the default font at
        export time while still looking correct on screen.
      </p>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Template
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {templates.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Họ và tên
          <input
            className="rounded border border-slate-300 px-2 py-1"
            value={content.fullName ?? ""}
            onChange={(event) => setContent((prev) => ({ ...prev, fullName: event.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Đơn vị / Chức vụ
          <input
            className="rounded border border-slate-300 px-2 py-1"
            value={content.role ?? ""}
            onChange={(event) => setContent((prev) => ({ ...prev, role: event.target.value }))}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Thông điệp
          <textarea
            className="rounded border border-slate-300 px-2 py-1"
            rows={2}
            value={content.message ?? ""}
            onChange={(event) => setContent((prev) => ({ ...prev, message: event.target.value }))}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            PrintArea (DOM/CSS + modern-screenshot)
          </h2>
          <div
            style={{
              width: template.canvas.width * displayScale,
              height: template.canvas.height * displayScale,
            }}
            className="overflow-hidden rounded border border-slate-200"
          >
            <div
              style={{
                width: template.canvas.width,
                height: template.canvas.height,
                transform: `scale(${displayScale})`,
                transformOrigin: "top left",
              }}
            >
              {/* No `isDevMod` here on purpose: it forces a black debug
                  background behind Name/Role/Message, which — combined
                  with a template that sets an explicit black textColor
                  (e.g. modernPortrait's messageBox) — renders invisible
                  black-on-black text. Plain (production) mode is the fair
                  comparison against KonvaPrintArea, which has no
                  equivalent dev-mode visualization. */}
              <PrintArea ref={domRef} template={template} content={content} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportDom}
            disabled={exporting !== null}
            className="self-start rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {exporting === "dom" ? "Exporting…" : "Export via PrintArea"}
          </button>
          {domExportUrl && (
            <a href={domExportUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              Open exported image
            </a>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-700">KonvaPrintArea (canvas-native)</h2>
          <div
            style={{
              width: template.canvas.width * displayScale,
              height: template.canvas.height * displayScale,
            }}
            className="overflow-hidden rounded border border-slate-200"
          >
            <div
              style={{
                width: template.canvas.width,
                height: template.canvas.height,
                transform: `scale(${displayScale})`,
                transformOrigin: "top left",
              }}
            >
              <KonvaPrintArea ref={konvaStageRef} template={template} content={content} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportKonva}
            disabled={exporting !== null}
            className="self-start rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {exporting === "konva" ? "Exporting…" : "Export via KonvaPrintArea"}
          </button>
          {konvaExportUrl && (
            <a href={konvaExportUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              Open exported image
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrintAreaKonvaSpike;
