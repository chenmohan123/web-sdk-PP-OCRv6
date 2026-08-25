export type ImageSize = { width: number; height: number };
export type ViewportSize = { width: number; height: number };
export type Offset = { x: number; y: number };
export type ZoomResult = { scale: number; offset: Offset };

const EPSILON = 0.0001;

export function fitScale(image: ImageSize, viewport: ViewportSize): number {
  if (image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 1;
  return Math.min(1, viewport.width / image.width, viewport.height / image.height);
}

export function clampOffset(offset: Offset, scale: number, image: ImageSize, viewport: ViewportSize): Offset {
  const halfWidth = Math.max(0, (image.width * scale - viewport.width) / 2);
  const halfHeight = Math.max(0, (image.height * scale - viewport.height) / 2);
  return {
    x: Math.min(halfWidth, Math.max(-halfWidth, offset.x)),
    y: Math.min(halfHeight, Math.max(-halfHeight, offset.y)),
  };
}

export function zoomAroundPoint(
  offset: Offset,
  scale: number,
  nextScale: number,
  point: Offset,
  image: ImageSize,
  viewport: ViewportSize,
): ZoomResult {
  if (Math.abs(scale) < EPSILON) return { scale: nextScale, offset: { x: 0, y: 0 } };
  const imagePoint = { x: (point.x - offset.x) / scale, y: (point.y - offset.y) / scale };
  const nextOffset = { x: point.x - imagePoint.x * nextScale, y: point.y - imagePoint.y * nextScale };
  return { scale: nextScale, offset: clampOffset(nextOffset, nextScale, image, viewport) };
}

