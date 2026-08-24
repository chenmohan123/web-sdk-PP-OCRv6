import { describe, expect, it, vi } from "vitest";
import { createOCRPipeline } from "../src/pipeline/ocr";

const timings = { modelDownloadMs: 1, modelCacheReadMs: 2, integrityMs: 3, sessionMs: 4, decodeMs: 5, preprocessMs: 6, inferenceMs: 7, postprocessMs: 8, totalMs: 36 };
const runtime = { requestedBackend: "wasm" as const, actualBackend: "wasm" as const, execution: "main" as const, runtimeVersion: "ort" };
const model = { id: "pp-ocrv6", version: "1.0.0", preset: "small" as const };

describe("OCR pipeline", () => {
  it("sorts a copy in reading order and joins recognition by stable detector index", async () => {
    const detections = [
      { index: 8, score: 0.8, polygon: [{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }, { x: 20, y: 30 }] },
      { index: 2, score: 0.9, polygon: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }] },
      { index: 4, score: 0.7, polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
    ];
    const detector = { kind: "detector" as const, load: vi.fn(), detect: vi.fn().mockResolvedValue({ detections, image: { width: 40, height: 40 }, model, runtime, timings }), dispose: vi.fn() };
    const recognizer = { kind: "recognizer" as const, load: vi.fn(), recognize: vi.fn().mockResolvedValue({ recognitions: [{ index: 4, text: "左", score: 0.95 }, { index: 2, text: "右", score: 0.9 }, { index: 8, text: "下", score: 0.85 }], image: { width: 10, height: 10 }, model, runtime, timings }), dispose: vi.fn() };
    const raster = { width: 40, height: 40, source: "image" as const, data: new Uint8ClampedArray(40 * 40 * 4) };
    const pipeline = createOCRPipeline({ detector, recognizer, decode: vi.fn().mockResolvedValue(raster), model, runtime });
    const result = await pipeline.ocr("image");
    expect(result.lines.map((line) => [line.index, line.text])).toEqual([[4, "左"], [2, "右"], [8, "下"]]);
    expect(result.detections.map((item) => item.index)).toEqual([8, 2, 4]);
    expect(recognizer.recognize).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ index: 4 })]), expect.any(Object));
  });

  it("propagates disposal to both components and rejects later runs", async () => {
    const detector = { kind: "detector" as const, load: vi.fn(), detect: vi.fn(), dispose: vi.fn() };
    const recognizer = { kind: "recognizer" as const, load: vi.fn(), recognize: vi.fn(), dispose: vi.fn() };
    const pipeline = createOCRPipeline({ detector, recognizer, decode: vi.fn(), model, runtime });
    await pipeline.dispose();
    expect(detector.dispose).toHaveBeenCalledOnce();
    expect(recognizer.dispose).toHaveBeenCalledOnce();
    await expect(pipeline.ocr("image")).rejects.toMatchObject({ code: "DISPOSED" });
  });
});
