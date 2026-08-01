/**
 * Reads an uploaded image file's native pixel dimensions — the free-form
 * layout editor derives a campaign's canvas size from this (rather than
 * forcing every campaign onto one fixed canvas, see
 * docs/specs/free-form-layout-editor.md), so it needs to know the actual
 * decoded size before it can compute a default box layout.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể đọc kích thước ảnh nền.'));
    };
    image.src = objectUrl;
  });
}
