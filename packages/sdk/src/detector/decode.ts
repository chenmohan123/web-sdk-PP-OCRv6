import { PPOCRv6Error } from "../errors";

export interface RasterImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly source: "image" | "canvas" | "bitmap" | "video";
}

const invalid = (message: string): PPOCRv6Error => new PPOCRv6Error("INVALID_INPUT", message);
const isRaster = (value: unknown): value is { width: number; height: number; data: Uint8ClampedArray } => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { width?: unknown; height?: unknown; data?: unknown };
  return typeof candidate.width === "number" && typeof candidate.height === "number" && candidate.data instanceof Uint8ClampedArray;
};

function validateRaster(value: { width: number; height: number; data: Uint8ClampedArray }, source: RasterImage["source"]): RasterImage {
  if (!Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width <= 0 || value.height <= 0 || value.data.length !== value.width * value.height * 4) throw invalid("Image dimensions and RGBA pixel data are inconsistent");
  return { width: value.width, height: value.height, data: value.data, source };
}

async function canvasRaster(source: CanvasImageSource, width: number, height: number, kind: RasterImage["source"]): Promise<RasterImage> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw invalid("2D canvas is unavailable");
    context.drawImage(source, 0, 0, width, height);
    return validateRaster(context.getImageData(0, 0, width, height), kind);
  }
  if (typeof document === "undefined") throw invalid("Image decoding requires Canvas or OffscreenCanvas support");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw invalid("2D canvas is unavailable");
  context.drawImage(source, 0, 0, width, height);
  return validateRaster(context.getImageData(0, 0, width, height), kind);
}

async function decodeBlob(blob: Blob): Promise<RasterImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      try { return await canvasRaster(bitmap, bitmap.width, bitmap.height, "bitmap"); } finally { bitmap.close(); }
    } catch (error) { throw invalid(`Unable to decode image: ${error instanceof Error ? error.message : String(error)}`); }
  }
  if (typeof document === "undefined") throw invalid("Blob decoding requires createImageBitmap or a browser document");
  const url = URL.createObjectURL(blob);
  try { return await decodeUrl(url); } finally { URL.revokeObjectURL(url); }
}

async function decodeUrl(url: string): Promise<RasterImage> {
  if (typeof document === "undefined") throw invalid("URL decoding requires a browser document");
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(invalid("Unable to load image URL; check the URL and CORS headers")); image.src = url; });
  return canvasRaster(image, image.naturalWidth, image.naturalHeight, "image");
}

export async function decodeImage(input: unknown): Promise<RasterImage> {
  if (isRaster(input)) return validateRaster(input, "image");
  if (typeof Blob !== "undefined" && input instanceof Blob) return decodeBlob(input);
  if (typeof input === "string") return decodeUrl(input);
  if (typeof ImageBitmap !== "undefined" && input instanceof ImageBitmap) return canvasRaster(input, input.width, input.height, "bitmap");
  if (typeof HTMLImageElement !== "undefined" && input instanceof HTMLImageElement) return canvasRaster(input, input.naturalWidth, input.naturalHeight, "image");
  if (typeof HTMLCanvasElement !== "undefined" && input instanceof HTMLCanvasElement) return canvasRaster(input, input.width, input.height, "canvas");
  throw invalid("Unsupported image input");
}
