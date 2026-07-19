/**
 * Curated, Vietnamese-diacritic-supporting Google Fonts a campaign owner can
 * pick for a campaign's name/role/message text (see LayoutEditor.tsx).
 *
 * Sourced from Google Fonts' own metadata (`fonts.google.com/metadata/fonts`)
 * filtered to `subsets.includes('vietnamese')` — every entry here has been
 * verified to declare that subset, so Vietnamese diacritics (á, ệ, ư, đ, …)
 * render correctly rather than falling back to a tofu/missing-glyph box.
 * Each `googleFontsHref` requests only the weights this app actually uses
 * (400/500/700, whichever the font defines — some display/handwriting fonts
 * only ship 400) to keep the fetched stylesheet small.
 */

export type FontCategory = "sans-serif" | "serif" | "display" | "handwriting";

export interface CuratedFont {
  /** CSS `font-family` value and Google Fonts family name (same string, both roles). */
  family: string;
  category: FontCategory;
  /** Generic CSS fallback family for this font's style. */
  fallback: string;
  /** Google Fonts css2 stylesheet URL — inject as a `<link rel="stylesheet">` to load it. */
  googleFontsHref: string;
}

function googleFontsHref(family: string, weights: string[]): string {
  const familyParam = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weights.join(";")}&display=swap`;
}

function sansSerifFont(family: string): CuratedFont {
  return {
    family,
    category: "sans-serif",
    fallback: "sans-serif",
    googleFontsHref: googleFontsHref(family, ["400", "500", "700"]),
  };
}

function serifFont(family: string): CuratedFont {
  return {
    family,
    category: "serif",
    fallback: "serif",
    googleFontsHref: googleFontsHref(family, ["400", "500", "700"]),
  };
}

function displayFont(family: string, weights: string[]): CuratedFont {
  return {
    family,
    category: "display",
    fallback: "cursive",
    googleFontsHref: googleFontsHref(family, weights),
  };
}

function handwritingFont(family: string, weights: string[]): CuratedFont {
  return {
    family,
    category: "handwriting",
    fallback: "cursive",
    googleFontsHref: googleFontsHref(family, weights),
  };
}

export const CURATED_FONTS: CuratedFont[] = [
  sansSerifFont("Be Vietnam Pro"),
  sansSerifFont("Roboto"),
  sansSerifFont("Open Sans"),
  sansSerifFont("Montserrat"),
  sansSerifFont("Nunito"),
  sansSerifFont("Josefin Sans"),
  serifFont("Playfair Display"),
  serifFont("Merriweather"),
  serifFont("Lora"),
  serifFont("Cormorant Garamond"),
  displayFont("Lobster", ["400"]),
  displayFont("Comfortaa", ["400", "500", "700"]),
  displayFont("Baloo 2", ["400", "500", "700"]),
  displayFont("Yeseva One", ["400"]),
  handwritingFont("Dancing Script", ["400", "500", "700"]),
  handwritingFont("Pacifico", ["400"]),
  handwritingFont("Great Vibes", ["400"]),
  handwritingFont("Patrick Hand", ["400"]),
];

/** House default for campaigns without an explicit `layout.fontFamily`. Must be one of `CURATED_FONTS` — enforced by `fonts.test.ts`. */
export const DEFAULT_FONT_FAMILY = "Be Vietnam Pro";

const DEFAULT_FONT: CuratedFont =
  CURATED_FONTS.find((font) => font.family === DEFAULT_FONT_FAMILY) ?? CURATED_FONTS[0];

const FONTS_BY_FAMILY = new Map(CURATED_FONTS.map((font) => [font.family, font]));

/** Looks up a curated font by family name, falling back to the house default for anything unrecognized (e.g. a stale/removed entry saved on an old campaign). */
export function getCuratedFont(family: string | undefined): CuratedFont {
  const found = family ? FONTS_BY_FAMILY.get(family) : undefined;
  return found ?? DEFAULT_FONT;
}

/** Builds the quoted CSS `font-family` value (with generic fallback) for a given family name. */
export function cssFontFamily(family: string | undefined): string {
  const font = getCuratedFont(family);
  return `'${font.family}', ${font.fallback}`;
}
