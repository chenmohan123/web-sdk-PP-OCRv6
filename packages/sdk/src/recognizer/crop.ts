import { PPOCRv6Error } from "../errors";
import type { Detection, Point } from "../types";
import type { RasterImage } from "../detector/decode";

export interface IndexedCrop { readonly index: number; readonly image: RasterImage; }
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const pointAt = (polygon: readonly Point[], u: number, v: number): Point => {
  const [topLeft, topRight, bottomRight, bottomLeft] = polygon;
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) throw new PPOCRv6Error("INVALID_INPUT", "A recognition crop requires a four-point polygon");
  return {
    x: (1 - u) * (1 - v) * topLeft.x + u * (1 - v) * topRight.x + u * v * bottomRight.x + (1 - u) * v * bottomLeft.x,
    y: (1 - u) * (1 - v) * topLeft.y + u * (1 - v) * topRight.y + u * v * bottomRight.y + (1 - u) * v * bottomLeft.y,
  };
};

export function cropPolygon(source: RasterImage, detection: Detection): IndexedCrop {
  if (detection.polygon.length !== 4) throw new PPOCRv6Error("INVALID_INPUT", "A recognition crop requires a quadrilateral");
  const [a, b, c, d] = detection.polygon as readonly [Point, Point, Point, Point];
  const width = Math.max(1, Math.round(Math.max(distance(a, b), distance(d, c))));
  const height = Math.max(1, Math.round(Math.max(distance(a, d), distance(b, c))));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const point = pointAt(detection.polygon, width === 1 ? 0.5 : x / (width - 1), height === 1 ? 0.5 : y / (height - 1));
    const sourceX = Math.max(0, Math.min(source.width - 1, Math.floor(point.x)));
    const sourceY = Math.max(0, Math.min(source.height - 1, Math.floor(point.y)));
    const sourceOffset = (sourceY * source.width + sourceX) * 4;
    const targetOffset = (y * width + x) * 4;
    data.set(source.data.subarray(sourceOffset, sourceOffset + 4), targetOffset);
  }
  return { index: detection.index, image: { width, height, data, source: source.source } };
}
