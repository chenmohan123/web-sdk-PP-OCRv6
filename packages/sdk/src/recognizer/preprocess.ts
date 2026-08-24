import type { RasterImage } from "../detector/decode";

export interface RecognitionPreprocessOptions {
  readonly height?: number;
  readonly width?: number;
  readonly scale?: number;
  readonly mean?: readonly [number, number, number];
  readonly std?: readonly [number, number, number];
}
export interface RecognitionTensor {
  readonly data: Float32Array;
  readonly dims: readonly [1, 3, number, number];
  readonly contentWidth: number;
}

export function preprocessRecognition(image: RasterImage, options: RecognitionPreprocessOptions = {}): RecognitionTensor {
  const height = options.height ?? 48;
  const width = options.width ?? 320;
  const contentWidth = Math.max(1, Math.min(width, Math.ceil(height * image.width / image.height)));
  const scale = options.scale ?? 1 / 255;
  const mean = options.mean ?? [0.5, 0.5, 0.5];
  const std = options.std ?? [0.5, 0.5, 0.5];
  const plane = height * width;
  const data = new Float32Array(plane * 3);
  const channels = [2, 1, 0] as const;
  for (let channel = 0; channel < 3; channel += 1) for (let y = 0; y < height; y += 1) for (let x = 0; x < contentWidth; x += 1) {
    const sourceX = Math.min(image.width - 1, Math.floor(x / contentWidth * image.width));
    const sourceY = Math.min(image.height - 1, Math.floor(y / height * image.height));
    const pixel = image.data[(sourceY * image.width + sourceX) * 4 + channels[channel]!] ?? 0;
    data[channel * plane + y * width + x] = (pixel * scale - mean[channel]!) / std[channel]!;
  }
  return { data, dims: [1, 3, height, width], contentWidth };
}
