import { describe, expect, it, vi } from "vitest";
import { createDetectorEngine } from "../src/detector/detector";

const asset = {
  id: "PP-OCRv6_small_det", role: "det" as const, bytes: 4, sha256: "a".repeat(64), url: "https://cdn.test/det.onnx",
  input: { name: "x", dtype: "float32", shape: ["N", 3, "H", "W"] }, output: { name: "y", dtype: "float32", shape: ["N", 1, "H", "W"] },
  preprocessing: { color: "BGR" }, postprocessing: { name: "DBPostProcess", thresh: 0.5, boxThresh: 0.5, unclipRatio: 1, minSize: 1, maxCandidates: 10 },
};

describe("detector lifecycle", () => {
  it("loads once, runs inference, and reports original-pixel detections and timings", async () => {
    const release = vi.fn();
    const run = vi.fn().mockResolvedValue({ y: { data: new Float32Array([0.9]), dims: [1, 1, 1, 1] } });
    const detector = createDetectorEngine({
      asset,
      model: { id: "pp-ocrv6", version: "1.0.0", preset: "small" },
      runtime: { requestedBackend: "wasm", actualBackend: "wasm", execution: "main", runtimeVersion: "onnxruntime-web@1.27.0" },
      loadModel: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3, 4]), timings: { modelDownloadMs: 1, modelCacheReadMs: 2, integrityMs: 3 } }),
      createExecutor: vi.fn().mockResolvedValue({ sessionMs: 4, run, dispose: release }),
    });
    await detector.load();
    const result = await detector.detect({ width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255]) });
    expect(result.detections).toHaveLength(1);
    expect(result.image).toMatchObject({ width: 1, height: 1 });
    expect(result.timings).toMatchObject({ modelDownloadMs: 1, modelCacheReadMs: 2, integrityMs: 3, sessionMs: 4 });
    await detector.dispose();
    expect(release).toHaveBeenCalledOnce();
    await expect(detector.detect({ width: 1, height: 1, data: new Uint8ClampedArray(4) })).rejects.toMatchObject({ code: "DISPOSED" });
  });

  it("rejects an already-aborted run before invoking inference", async () => {
    const run = vi.fn();
    const detector = createDetectorEngine({ asset, model: { id: "pp", version: "1" }, runtime: { requestedBackend: "wasm", actualBackend: "wasm", execution: "main", runtimeVersion: "ort" }, loadModel: vi.fn().mockResolvedValue({ bytes: new Uint8Array(4), timings: { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0 } }), createExecutor: vi.fn().mockResolvedValue({ sessionMs: 0, run, dispose: vi.fn() }) });
    const controller = new AbortController();
    controller.abort();
    await expect(detector.detect({ width: 1, height: 1, data: new Uint8ClampedArray(4) }, { signal: controller.signal })).rejects.toMatchObject({ code: "ABORTED" });
    expect(run).not.toHaveBeenCalled();
  });
});
