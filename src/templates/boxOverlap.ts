import { AvatarBoxConfig, Box } from './types';

/**
 * True when two boxes' interiors intersect. Boxes that merely touch at an
 * edge (e.g. one box's bottom equals another's top) are NOT considered
 * overlapping — several of the gallery's templates intentionally stack boxes
 * flush against each other.
 */
export function doBoxesOverlap(a: Box, b: Box): boolean {
  const aRight = a.left + a.width;
  const aBottom = a.top + a.height;
  const bRight = b.left + b.width;
  const bBottom = b.top + b.height;

  const horizontallyOverlapping = a.left < bRight && aRight > b.left;
  const verticallyOverlapping = a.top < bBottom && aBottom > b.top;

  return horizontallyOverlapping && verticallyOverlapping;
}

/**
 * The 'diamond' avatar shape (see Avatar.tsx) is a WxH box rotated 45deg
 * around its own center. Layout position/size stay WxH, but the *painted*
 * footprint grows to a W*sqrt(2) x H*sqrt(2) box centered on the same
 * point. Overlap checks must use this painted footprint — the declared
 * avatarBox understates how much space a diamond avatar actually occupies.
 */
export function effectiveAvatarBox(box: AvatarBoxConfig): Box {
  if (box.shape !== 'diamond') {
    return { top: box.top, left: box.left, width: box.width, height: box.height };
  }

  const inflatedWidth = box.width * Math.SQRT2;
  const inflatedHeight = box.height * Math.SQRT2;

  return {
    top: box.top - (inflatedHeight - box.height) / 2,
    left: box.left - (inflatedWidth - box.width) / 2,
    width: inflatedWidth,
    height: inflatedHeight,
  };
}

export interface NamedBox {
  name: string;
  box: Box;
}

export interface BoxOverlap {
  a: string;
  b: string;
}

/** Returns every pairwise overlap among the given named boxes. Empty when clean. */
export function findOverlappingBoxes(boxes: NamedBox[]): BoxOverlap[] {
  const overlaps: BoxOverlap[] = [];

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (doBoxesOverlap(boxes[i].box, boxes[j].box)) {
        overlaps.push({ a: boxes[i].name, b: boxes[j].name });
      }
    }
  }

  return overlaps;
}
