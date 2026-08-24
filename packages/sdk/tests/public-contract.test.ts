import { describe, expect, it } from "vitest";
import { DEFAULT_MANIFEST_URL } from "../src/factory";
import type { CustomModel, DetectionResult, ModelSelection, RuntimeInfo } from "../src/types";

const customManifest: CustomModel = { manifest: { id: "custom-ocr", version: "1.0.0" } };
const customManifestUrl: CustomModel = { manifestUrl: "https://example.test/custom-ocr.yaml" };
const presetSelection: ModelSelection = { det: "small", rec: "tiny" };
const customSelection: ModelSelection = { det: customManifest, rec: customManifestUrl };

const result: DetectionResult = {
  detections: [],
  image: { width: 100, height: 50 },
  model: { id: "pp-ocrv6", version: "1.0.0" },
  runtime: { requestedBackend: "wasm", actualBackend: "wasm", execution: "main", runtimeVersion: "onnxruntime-web@1.27.0" },
  timings: {
    modelDownloadMs: 0,
    modelCacheReadMs: 0,
    integrityMs: 0,
    sessionMs: 0,
    decodeMs: 0,
    preprocessMs: 0,
    inferenceMs: 0,
    postprocessMs: 0,
    totalMs: 0,
  },
};

describe("public runtime result contract", () => {
  // @ts-expect-error RuntimeInfo must report the ONNX Runtime Web version.
  const incompleteRuntime: RuntimeInfo = { requestedBackend: "wasm", actualBackend: "wasm", execution: "main" };

  it("reports image, model, runtime, and all timing phases", () => {
    expect(incompleteRuntime).toBeDefined();
    expect([customManifest, presetSelection, customSelection]).toHaveLength(3);
    expect(result).toMatchObject({ image: { width: 100, height: 50 }, model: { id: "pp-ocrv6" }, runtime: { actualBackend: "wasm" } });
    expect(result.timings).toMatchObject({ decodeMs: 0, totalMs: 0 });
  });

  it("loads the default manifest from a browser CORS-compatible origin", () => {
    expect(DEFAULT_MANIFEST_URL).toMatch(/^https:\/\/raw\.githubusercontent\.com\/chenmohan123\/web-sdk-PP-OCRv6\/main\/models\/pp-ocrv6\/1\.0\.0\/manifest\.json$/);
  });
});
