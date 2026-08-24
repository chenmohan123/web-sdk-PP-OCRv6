import { describe, expect, it, vi } from "vitest";
import { createRecognizerEngine } from "../src/recognizer/recognizer";

const asset = {
  id: "PP-OCRv6_small_rec", role: "rec" as const, bytes: 4, sha256: "a".repeat(64), url: "https://cdn.test/rec.onnx",
  input: { name: "x", dtype: "float32", shape: ["N", 3, 48, "W"] }, output: { name: "y", dtype: "float32", shape: ["N", "T", 3] },
  preprocessing: { color: "BGR", resize: { height: 1, width: 2, keepRatio: true, pad: "right" }, normalize: { scale: "1/255", mean: [0, 0, 0], std: [1, 1, 1] } },
  decoder: { name: "CTCLabelDecode", blankIndex: 0, dictionary: "dict.txt" },
};

describe("recognizer lifecycle", () => {
  it("batches crops, decodes text, preserves indices, and disposes once", async () => {
    const dispose = vi.fn();
    const run = vi.fn().mockResolvedValue({ y: { data: new Float32Array([0.05, 0.9, 0.05, 0.9, 0.05, 0.05]), dims: [1, 2, 3] } });
    const recognizer = createRecognizerEngine({ asset, dictionary: ["你", "好"], model: { id: "pp-ocrv6", version: "1.0.0", preset: "small" }, runtime: { requestedBackend: "wasm", actualBackend: "wasm", execution: "main", runtimeVersion: "ort" }, loadModel: vi.fn().mockResolvedValue({ bytes: new Uint8Array(4), timings: { modelDownloadMs: 1, modelCacheReadMs: 0, integrityMs: 2 } }), createExecutor: vi.fn().mockResolvedValue({ sessionMs: 3, run, dispose }) });
    const result = await recognizer.recognize([{ index: 9, image: { width: 1, height: 1, source: "image", data: new Uint8ClampedArray([255, 255, 255, 255]) } }]);
    expect(result.recognitions).toMatchObject([{ index: 9, text: "你" }]);
    expect(result.recognitions[0]!.score).toBeCloseTo(0.9, 6);
    expect(result.timings).toMatchObject({ modelDownloadMs: 1, integrityMs: 2, sessionMs: 3 });
    await recognizer.dispose();
    await recognizer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("rejects invalid empty batches", async () => {
    const recognizer = createRecognizerEngine({ asset, dictionary: ["x"], model: { id: "pp", version: "1" }, runtime: { requestedBackend: "wasm", actualBackend: "wasm", execution: "main", runtimeVersion: "ort" }, loadModel: vi.fn(), createExecutor: vi.fn() });
    await expect(recognizer.recognize([])).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
