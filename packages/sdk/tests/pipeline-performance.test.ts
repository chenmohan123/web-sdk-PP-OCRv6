import { describe, expect, it, vi } from "vitest";
import { createOCRPipeline } from "../src/pipeline/ocr";
const timings = { modelDownloadMs: 1, modelCacheReadMs: 2, integrityMs: 3, sessionMs: 4, decodeMs: 5, preprocessMs: 6, inferenceMs: 7, postprocessMs: 8, totalMs: 36 };
const runtime = { requestedBackend: "auto" as const, actualBackend: "wasm" as const, execution: "main" as const, runtimeVersion: "ort" };
const model = { id: "test", version: "1" };
const raster = { width: 8, height: 8, source: "image" as const, data: new Uint8ClampedArray(256) };
describe("OCR 流水线耗时和实际后端", () => {
  it.each([
    { det: undefined, rec: undefined, expected: undefined, empty: false },
    { det: "warm", rec: undefined, expected: undefined, empty: false },
    { det: undefined, rec: "cold", expected: "cold", empty: false },
    { det: "warm", rec: "warm", expected: "warm", empty: false },
    { det: "cold", rec: undefined, expected: "cold", empty: false },
    { det: "warm", rec: undefined, expected: "warm", empty: true },
    { det: undefined, rec: undefined, expected: undefined, empty: true },
  ] as const)("兼容缺少加载状态的旧组件：$det / $rec，空检测 $empty", async ({ det, rec, expected, empty }) => {
    const detection = { index: 0, score: 0.9, polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }] };
    const detector = { kind: "detector" as const, load: vi.fn(), detect: vi.fn().mockResolvedValue({ detections: empty ? [] : [detection], image: raster, model, runtime, timings: { ...timings, ...(det ? { loadState: det } : {}) } }), dispose: vi.fn() };
    const recognizer = { kind: "recognizer" as const, load: vi.fn(), recognize: vi.fn().mockResolvedValue({ recognitions: [{ index: 0, text: "A", score: 0.9 }], image: raster, model, runtime, timings: { ...timings, ...(rec ? { loadState: rec } : {}) } }), dispose: vi.fn() };
    const pipeline = createOCRPipeline({ detector, recognizer, decode: async () => raster, model, runtime });
    const result = await pipeline.ocr("image");
    expect(result.timings.loadState).toBe(expected);
    if (expected === undefined) expect(result.timings).not.toHaveProperty("loadState");
  });
  it("空检测结果只累计一次检测分项，并计入入口解码", async () => {
    let now = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const detector = { kind: "detector" as const, load: vi.fn(), detect: vi.fn().mockResolvedValue({ detections: [], image: raster, model, runtime, timings }), dispose: vi.fn() };
    const recognizer = { kind: "recognizer" as const, load: vi.fn(), recognize: vi.fn(), dispose: vi.fn() };
    const pipeline = createOCRPipeline({ detector, recognizer, decode: async () => { now += 25; return raster; }, model, runtime });
    try {
      const result = await pipeline.ocr("image");
      expect(result.timings).toMatchObject({ decodeMs: 30, preprocessMs: 6, inferenceMs: 7, postprocessMs: 8 });
      expect(result.stageTimings.recognitionMs).toBe(0);
      expect(recognizer.recognize).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });
  it("从已执行组件报告后端，并保留 DET/REC 的不同后端", async () => {
    const detection = { index: 0, score: 0.9, polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }] };
    const detector = { kind: "detector" as const, load: vi.fn(), detect: vi.fn().mockResolvedValue({ detections: [detection], image: raster, model, runtime, timings }), dispose: vi.fn() };
    const recognizer = { kind: "recognizer" as const, load: vi.fn(), recognize: vi.fn().mockResolvedValue({ recognitions: [{ index: 0, text: "A", score: 0.9 }], image: raster, model, runtime: { ...runtime, actualBackend: "webgpu" }, timings }), dispose: vi.fn() };
    const pipeline = createOCRPipeline({ detector, recognizer, decode: async () => raster, model, runtime: { ...runtime, actualBackend: "webgpu" } });
    expect((await pipeline.ocr("image")).runtime).toMatchObject({ actualBackend: "wasm", componentBackends: { det: "wasm", rec: "webgpu" } });
  });
});
