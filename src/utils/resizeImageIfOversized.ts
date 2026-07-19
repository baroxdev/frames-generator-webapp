const DEFAULT_MAX_DIMENSION = 2400;
const DEFAULT_QUALITY = 0.9;

/**
 * Computes the target width/height for downscaling an image whose longer
 * side exceeds `maxDimension`, preserving aspect ratio — returns `null` if
 * the image is already within the limit (nothing to do). Pulled out from
 * `resizeImageIfOversized` as pure logic so it's unit-testable without a
 * real `<canvas>` (jsdom has none — see `measureText.ts`'s own fallback for
 * the same constraint).
 */
export function computeDownscaleTarget(
  width: number,
  height: number,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
): { width: number; height: number } | null {
  const longerSide = Math.max(width, height);
  if (longerSide <= maxDimension) return null;

  const scale = maxDimension / longerSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể đọc ảnh để thu nhỏ.'));
    image.src = src;
  });
}

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh (canvas 2D).');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/**
 * Downscales `source` to exactly `targetWidth`x`targetHeight` in halving
 * steps rather than one single large blit — a canvas's bilinear resampling
 * introduces visible aliasing/shimmer when shrinking by a large factor
 * (e.g. the ~5.5x reduction a 13334px-wide upload needs to reach 2400px) in
 * one pass; repeatedly halving keeps each individual step small enough to
 * stay clean, the standard mitigation for canvas image resizing.
 */
function stepDownDraw(
  source: HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;
  let currentSource: CanvasImageSource = source;

  while (currentWidth / 2 > targetWidth && currentHeight / 2 > targetHeight) {
    const nextWidth = Math.round(currentWidth / 2);
    const nextHeight = Math.round(currentHeight / 2);
    const step = document.createElement('canvas');
    step.width = nextWidth;
    step.height = nextHeight;
    getContext2d(step).drawImage(currentSource, 0, 0, nextWidth, nextHeight);
    currentSource = step;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  const final = document.createElement('canvas');
  final.width = targetWidth;
  final.height = targetHeight;
  getContext2d(final).drawImage(currentSource, 0, 0, targetWidth, targetHeight);
  return final;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không thể xuất ảnh đã thu nhỏ.'))),
      type,
      quality,
    );
  });
}

// PNG/WebP re-encode losslessly (or near-so) at the new, smaller pixel
// count, so there's no quality tradeoff in keeping the original type —
// unlike JPEG, `quality` is simply ignored for these by `canvas.toBlob`.
// Anything else (shouldn't happen given NewCampaignPage's own upload
// accept-list) falls back to JPEG.
const SUPPORTED_OUTPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function outputTypeFor(file: File): string {
  return SUPPORTED_OUTPUT_TYPES.has(file.type) ? file.type : 'image/jpeg';
}

/**
 * Downscales an image file to fit within `maxDimension` on its longer side,
 * returning a new `File` — owners have uploaded backgrounds as large as
 * 13334x7500, which (a) makes the message auto-fit math size text relative
 * to an oversized box (see `MAX_AUTO_FIT_FONT_FACTOR` in `Message.tsx`) and
 * (b) forces `PrintArea.tsx` to rasterize a DOM at that same huge
 * resolution for the final export. Files already at or under the limit are
 * returned unchanged — re-encoding an already-reasonable image would only
 * cost quality for no benefit.
 */
export async function resizeImageIfOversized(
  file: File,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  quality: number = DEFAULT_QUALITY,
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const target = computeDownscaleTarget(image.naturalWidth, image.naturalHeight, maxDimension);
    if (!target) return file;

    const canvas = stepDownDraw(image, image.naturalWidth, image.naturalHeight, target.width, target.height);
    const type = outputTypeFor(file);
    const blob = await canvasToBlob(canvas, type, quality);
    return new File([blob], file.name, { type });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
