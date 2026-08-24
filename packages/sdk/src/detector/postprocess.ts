import { PPOCRv6Error } from "../errors";
import type { Detection, Point } from "../types";

export interface ProbabilityTensor { readonly data: Float32Array; readonly dims: readonly number[]; }
export interface DetectionPostprocessOptions {
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly threshold: number;
  readonly boxThreshold: number;
  readonly unclipRatio: number;
  readonly minSize?: number;
  readonly maxCandidates?: number;
}

interface Pixel { x: number; y: number; value: number }
const clip = (value: number, maximum: number): number => Math.min(maximum, Math.max(0, value));

function components(data: Float32Array, width: number, height: number, threshold: number, limit: number): Pixel[][] {
  const seen = new Uint8Array(width * height);
  const result: Pixel[][] = [];
  const directions = [-1, 0, 1] as const;
  for (let offset = 0; offset < data.length && result.length < limit; offset += 1) {
    if (seen[offset] || (data[offset] ?? 0) < threshold) continue;
    const queue = [offset];
    const group: Pixel[] = [];
    seen[offset] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      const x = current % width;
      const y = Math.floor(current / width);
      group.push({ x, y, value: data[current] ?? 0 });
      for (const dy of directions) for (const dx of directions) {
        if (dx === 0 && dy === 0) continue;
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (!seen[next] && (data[next] ?? 0) >= threshold) { seen[next] = 1; queue.push(next); }
      }
    }
    result.push(group);
  }
  return result;
}

function polygonFor(group: readonly Pixel[], mapWidth: number, mapHeight: number, options: DetectionPostprocessOptions): readonly Point[] | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pixel of group) { minX = Math.min(minX, pixel.x); minY = Math.min(minY, pixel.y); maxX = Math.max(maxX, pixel.x + 1); maxY = Math.max(maxY, pixel.y + 1); }
  if (maxX - minX < (options.minSize ?? 3) || maxY - minY < (options.minSize ?? 3)) return undefined;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const halfWidth = (maxX - minX) * options.unclipRatio / 2;
  const halfHeight = (maxY - minY) * options.unclipRatio / 2;
  const left = clip((centerX - halfWidth) / mapWidth * options.originalWidth, options.originalWidth);
  const right = clip((centerX + halfWidth) / mapWidth * options.originalWidth, options.originalWidth);
  const top = clip((centerY - halfHeight) / mapHeight * options.originalHeight, options.originalHeight);
  const bottom = clip((centerY + halfHeight) / mapHeight * options.originalHeight, options.originalHeight);
  return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
}

export function postprocessDetection(tensor: ProbabilityTensor, options: DetectionPostprocessOptions): readonly Detection[] {
  const height = tensor.dims.at(-2);
  const width = tensor.dims.at(-1);
  if (!height || !width || tensor.data.length < height * width) throw new PPOCRv6Error("INFERENCE_FAILED", "Detection output tensor has an invalid shape");
  const detections: Detection[] = [];
  for (const group of components(tensor.data.subarray(0, height * width), width, height, options.threshold, options.maxCandidates ?? 3000)) {
    const score = group.reduce((sum, pixel) => sum + pixel.value, 0) / group.length;
    if (score < options.boxThreshold) continue;
    const polygon = polygonFor(group, width, height, options);
    if (!polygon) continue;
    detections.push({ index: detections.length, polygon, score });
  }
  return detections;
}
