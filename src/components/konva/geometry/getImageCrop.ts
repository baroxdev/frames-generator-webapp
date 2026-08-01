/**
 * Cover-fit crop rectangle (in source-image pixel space) for drawing `image`
 * into a `size`-shaped box via `Konva.Image`'s `cropX`/`cropY`/`cropWidth`/
 * `cropHeight` props — Konva's own documented recipe for CSS
 * `object-fit: cover` (see `getCrop` at
 * https://konvajs.org/docs/sandbox/Scale_Image_To_Fit.html), ported for the
 * 'center-middle' anchor only: every DOM `Avatar`/image use in this app is a
 * plain `object-cover` (always centered), never an edge-anchored crop.
 */
export function getCoverCrop(
  image: HTMLImageElement,
  size: { width: number; height: number },
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
  const aspectRatio = size.width / size.height;
  const imageRatio = image.width / image.height;

  const newWidth = aspectRatio >= imageRatio ? image.width : image.height * aspectRatio;
  const newHeight = aspectRatio >= imageRatio ? image.width / aspectRatio : image.height;

  return {
    cropX: (image.width - newWidth) / 2,
    cropY: (image.height - newHeight) / 2,
    cropWidth: newWidth,
    cropHeight: newHeight,
  };
}
