import { CuratedFont, getCuratedFont } from "../constants/fonts";

// Tracks stylesheet hrefs already appended so repeated calls (e.g. on every
// keystroke of a text field, or every font-picker re-render) don't pile up
// duplicate <link> tags.
const loadedHrefs = new Set<string>();

// Caches the in-flight/settled readiness promise per family+weight so
// `ensureFontReady` only ever does the work once per combo, even if called
// from multiple places (LayoutEditor + export pipeline) concurrently.
const readyPromises = new Map<string, Promise<void>>();

function loadStylesheet(href: string): Promise<void> {
  if (loadedHrefs.has(href)) return Promise.resolve();
  if (document.querySelector(`link[href="${href}"]`)) {
    loadedHrefs.add(href);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    // Without this, the browser fetches the stylesheet in no-cors mode:
    // the page still renders using it fine, but `document.styleSheets[i]
    // .cssRules` throws for a cross-origin stylesheet fetched that way,
    // making its rules unreadable to JS. `modern-screenshot`'s font
    // auto-discovery (frameCompositor.service.ts) relies on reading exactly
    // those rules to find and embed the matching `@font-face` — it silently
    // catches that exception and skips the stylesheet, so without
    // `crossOrigin` the live preview renders the picked font correctly
    // while the *exported* image falls back to a default font. Google's
    // css2 endpoint sends `Access-Control-Allow-Origin: *`, so requesting
    // it via CORS here is safe.
    link.crossOrigin = "anonymous";
    // Resolve on error too — a failed font fetch shouldn't hang the caller
    // forever; the browser just falls back to its default font at draw time.
    link.onload = () => {
      loadedHrefs.add(href);
      resolve();
    };
    link.onerror = () => {
      loadedHrefs.add(href);
      resolve();
    };
    document.head.appendChild(link);
  });
}

/**
 * Loads a curated Google Font's CSS (its `@font-face` declarations) by
 * injecting a `<link>` tag — fire-and-forget, for early warm-up (e.g. as
 * soon as Name/Role/Message mount, or every curated font when the picker
 * dropdown opens). Does NOT guarantee the font is actually usable yet by
 * the time this returns — see `ensureFontReady` for that.
 */
export function loadGoogleFont(family: string | undefined): void {
  if (typeof document === "undefined") return;
  const font = getCuratedFont(family);
  void loadStylesheet(font.googleFontsHref);
}

/**
 * Loads every curated font at once — used by the font picker dropdown so
 * each option can render a live preview in its own font as soon as the
 * dropdown opens, rather than only the currently-selected one.
 */
export function loadAllCuratedFonts(fonts: CuratedFont[]): void {
  if (typeof document === "undefined") return;
  fonts.forEach((font) => void loadStylesheet(font.googleFontsHref));
}

/**
 * Resolves only once `family` at `weight` is actually usable for
 * rasterization — waits for the Google Fonts stylesheet to load *and* that
 * specific weight's glyph file to download (via the CSS Font Loading API).
 *
 * This exists because `loadGoogleFont`'s injected `<link>` (and even
 * `document.fonts.ready`) don't reliably cover a font requested moments
 * earlier: `document.fonts.ready` only waits for `FontFace` entries already
 * registered at the time it's read, but a `@font-face` rule that arrives via
 * an external stylesheet isn't registered until that stylesheet itself has
 * been fetched and parsed — a separate, still-pending network request. Two
 * concrete bugs this closes:
 *   - LayoutEditor's Konva canvas silently drawing with a fallback font the
 *     first time a font is picked (canvas doesn't repaint on its own once
 *     the real font finishes loading — call sites must force a redraw).
 *   - The export pipeline (`frameCompositor.service.ts`) rasterizing with
 *     the wrong font when a campaign's font was just requested moments
 *     before compositing.
 */
export async function ensureFontReady(family: string | undefined, weight: number): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const font = getCuratedFont(family);
  const cacheKey = `${font.family}:${weight}`;
  let promise = readyPromises.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      await loadStylesheet(font.googleFontsHref);
      try {
        await document.fonts.load(`${weight} 16px "${font.family}"`);
      } catch {
        // Network or font-parsing failure — proceed anyway; the browser
        // falls back to its default font rather than this hanging forever.
      }
    })();
    readyPromises.set(cacheKey, promise);
  }
  return promise;
}
