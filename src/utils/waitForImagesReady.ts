export function waitForImagesReady(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));

  return Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }

      if (typeof img.decode === 'function') {
        return img.decode().catch(() => waitForImageLoadEvent(img));
      }

      return waitForImageLoadEvent(img);
    }),
  ).then(() => undefined);
}

function waitForImageLoadEvent(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}
