import { useEffect, useState } from 'react';

/**
 * Loads a URL into a plain `HTMLImageElement` for `react-konva`'s `Image`
 * node, which — unlike a DOM `<img>` — needs an already-loaded image object
 * rather than just a `src` string.
 */
export function useHtmlImage(src: string | undefined): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }

    const element = new window.Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => setImage(element);
    element.src = src;

    return () => {
      element.onload = null;
    };
  }, [src]);

  return image;
}
