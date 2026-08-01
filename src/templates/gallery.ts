import bgHozImage from '../assets/bg-hoz.png';
import backgroundImage from '../storage/background.png';
import thongDiepImage from '../storage/thong-diep.png';
import thongDiep01Image from '../storage/thong-diep-01.png';
import { Template } from './types';

/**
 * The initial template gallery. Each entry is a real, distinct design: a
 * different background plus a different arrangement of the avatar/name/
 * role/message boxes over it — not the same layout re-skinned.
 *
 * Three of the four share a 1500x843 canvas — the size the original,
 * pre-template App.tsx always hardcoded. `canvas` is still declared per-template:
 * PrintArea forces the background image to exactly `canvas` size (see
 * PrintArea.tsx), so a template is free to use a different width or height
 * to match its own background's native aspect ratio — see
 * `elegantCentered` below, whose background isn't 1500x843-shaped.
 */

const CANVAS_1500x843 = { width: 1500, height: 843 };

/**
 * "Cổ điển Kim cương" — a ceremonial, symmetrical layout: a diamond-cropped
 * avatar on the left, the name/role stacked underneath it, and the tribute
 * message filling the right-hand two-thirds of the frame.
 *
 * avatarBox is declared at 352x352 — smaller than the ~498x498 it visually
 * occupies — because Avatar.tsx renders 'diamond' by rotating the box
 * 45deg; a WxH box rotated 45deg paints a W*sqrt(2) x H*sqrt(2) diamond
 * centered on the same point. 352 * sqrt(2) ≈ 498, so the rendered diamond
 * ends up centered on the same point and at the same visual size a plain
 * 498x498 box would have been. See `effectiveAvatarBox` in boxOverlap.ts,
 * which the gallery's overlap tests use to check the *painted* footprint
 * rather than this declared one.
 */
const classicDiamond: Template = {
  id: 'classic-diamond',
  name: 'Cổ điển Kim cương',
  description: 'Ảnh đại diện kim cương bên trái, thông điệp nổi bật bên phải.',
  background: backgroundImage,
  canvas: CANVAS_1500x843,
  avatarBox: { top: 263, left: 189, width: 352, height: 352, shape: 'diamond' },
  nameBox: { top: 705, left: 130, width: 460, height: 55, shrinkAt: 30, textColor: '#fff' },
  roleBox: { top: 765, left: 120, width: 480, height: 50, shrinkAt: 29, textColor: '#fff' },
  messageBox: { top: 150, left: 680, width: 750, height: 560, textColor: '#1e3a8a' },
};

/**
 * "Hiện đại" — today's live layout (previously hardcoded directly into
 * App.tsx): a circular avatar upper-left, name/role centered beneath it,
 * and the message as a large block filling the right side.
 *
 * This is the template selected by default, so the current visual/export
 * output is preserved unless a different template is chosen.
 */
const modernPortrait: Template = {
  id: 'modern-portrait',
  name: 'Hiện đại',
  description: 'Ảnh đại diện tròn, tên và chức vụ căn giữa, thông điệp bên phải.',
  background: thongDiepImage,
  canvas: CANVAS_1500x843,
  avatarBox: { top: 335, left: 200, width: 286, height: 260, shape: 'circle' },
  nameBox: { top: 605, left: 159, width: 389, height: 40, shrinkAt: 29 },
  roleBox: { top: 650, left: 157, width: 389, height: 45, shrinkAt: 20 },
  messageBox: { top: 358, left: 506, width: 801, height: 229, textColor: '#000' },
};

/**
 * "Trang trọng" — an official congress layout: an oval-cropped avatar and
 * labeled "Họ và tên" / "Đơn vị" fields sit over the background's own
 * printed placeholder frame on the left, with the message inside its
 * printed card on the right. Box coordinates are hand-matched to where
 * thong-diep-01.png prints its own photo/label/card artwork, so the boxes
 * land inside — not on top of — that artwork.
 *
 * canvas is 1500x1061, not the 1500x843 the other templates share: this
 * background's natural aspect ratio (3508x2481) doesn't match 1500x843, and
 * PrintArea now forces the background image to exactly `canvas` size (see
 * PrintArea.tsx) — using 843 here would squash this specific image. 1061 =
 * 1500 * (2481/3508), i.e. this background at native aspect ratio.
 */
const elegantCentered: Template = {
  id: 'elegant-centered',
  name: 'Trang trọng',
  description: 'Khung Đại hội: ảnh đại diện và ô tên/đơn vị bên trái, thông điệp trong khung bên phải.',
  background: thongDiep01Image,
  canvas: { width: 1500, height: 1061 },
  avatarBox: { top: 322, left: 57, width: 440, height: 440, shape: 'circle' },
  // textColor is required here: these boxes sit on the background's own
  // white input-style fields, where Name/Role's white default text would
  // be invisible.
  nameBox: { top: 825, left: 25, width: 520, height: 60, shrinkAt: 30, textColor: '#1e3a8a' },
  roleBox: { top: 945, left: 25, width: 520, height: 60, shrinkAt: 29, textColor: '#1e3a8a' },
  messageBox: { top: 360, left: 595, width: 855, height: 640, textColor: '#1e3a8a' },
};

/**
 * "Tối giản" — a mirrored, minimalist layout: a square-cropped avatar sits
 * on the right, while name, role and message stack left-aligned down the
 * left column. Uses a plain illustrated background with no printed text of
 * its own, so it never clashes with wherever the boxes land.
 */
const minimalCard: Template = {
  id: 'minimal-card',
  name: 'Tối giản',
  description: 'Ảnh đại diện vuông bên phải; tên, chức vụ và thông điệp xếp bên trái.',
  background: bgHozImage,
  canvas: CANVAS_1500x843,
  avatarBox: { top: 180, left: 1020, width: 320, height: 320, shape: 'square' },
  nameBox: { top: 180, left: 140, width: 760, height: 70, shrinkAt: 30, textColor: '#1e3a8a' },
  roleBox: { top: 260, left: 140, width: 760, height: 55, shrinkAt: 29, textColor: '#1e3a8a' },
  // Kept clear of bg-hoz.png's hill/treeline illustration, which starts
  // around y=650 on this canvas.
  messageBox: { top: 340, left: 140, width: 760, height: 290, textColor: '#1e3a8a' },
};

const TEMPLATE_GALLERY: Template[] = [
  modernPortrait,
  classicDiamond,
  elegantCentered,
  minimalCard,
];

export const DEFAULT_TEMPLATE_ID = modernPortrait.id;

/**
 * The single access point for the template gallery. Kept as a plain
 * function (rather than exporting the array directly, or reaching into it
 * from a component) on purpose: this is static/local config today, but it's
 * also the seam a later ticket can wrap in a TanStack Query query-factory
 * once templates move to Supabase, without callers needing to change.
 */
export function getTemplateGallery(): Template[] {
  return TEMPLATE_GALLERY;
}

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATE_GALLERY.find((template) => template.id === id);
}
