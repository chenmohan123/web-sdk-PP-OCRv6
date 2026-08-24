import type { RasterImage } from "./decode";

export interface DetectionPreprocessOptions {
  readonly width?: number;
  readonly height?: number;
  readonly maxSide?: number;
  readonly scale?: number;
  readonly mean?: readonly [number, number, number];
  readonly std?: readonly [number, number, number];
}
export interface DetectionTensor {
  readonly data: Float32Array;
  readonly dims: readonly [1, 3, number, number];
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly resizedWidth: number;
  readonly resizedHeight: number;
}

const alignedSize = (size: number): number => Math.max(32, Math.round(size / 32) * 32);
const sample = (image: RasterImage, x: number, y: number, channel: number): number => {
  const sourceX = Math.min(image.width - 1, Math.max(0, Math.floor(x * image.width)));
  const sourceY = Math.min(image.height - 1, Math.max(0, Math.floor(y * image.height)));
  return image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0;
};

export function preprocessDetection(image: RasterImage, options: DetectionPreprocessOptions = {}): DetectionTensor {
  const maxSide = options.maxSide ?? 960;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = options.width ?? alignedSize(image.width * ratio);
  const height = options.height ?? alignedSize(image.height * ratio);
  const scale = options.scale ?? 1 / 255;
  const mean = options.mean ?? [0.485, 0.456, 0.406];
  const std = options.std ?? [0.229, 0.224, 0.225];
  const plane = width * height;
  const data = new Float32Array(plane * 3);
  const sourceChannels = [2, 1, 0] as const;
  for (let channel = 0; channel < 3; channel += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        data[channel * plane + y * width + x] = ((sample(image, x / width, y / height, sourceChannels[channel]!) * scale) - mean[channel]!) / std[channel]!;
      }
    }
  }
  return { data, dims: [1, 3, height, width], originalWidth: image.width, originalHeight: image.height, resizedWidth: width, resizedHeight: height };
}
