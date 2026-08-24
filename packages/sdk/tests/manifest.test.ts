import { describe, expect, it } from "vitest";
import { parseRuntimeManifest } from "../src/model/manifest";

const asset = { id: "small-det", role: "det", bytes: 4, sha256: "a".repeat(64), url: "./small.onnx", input: { name: "x", dtype: "float32", shape: ["N", 3, "H", "W"] }, output: { name: "y", dtype: "float32", shape: ["N", 1, "H", "W"] }, preprocessing: { color: "BGR" }, postprocessing: { name: "DBPostProcess" } };

describe("runtime manifest", () => {
  it("resolves relative asset URLs and validates the inference contract", () => {
    const manifest = parseRuntimeManifest({ modelId: "custom", version: "1.0.0", assets: [asset] }, "https://cdn.test/manifests/v1.json");
    expect(manifest.assets[0]!.url).toBe("https://cdn.test/manifests/small.onnx");
  });

  it("rejects incomplete detection and recognition assets", () => {
    expect(() => parseRuntimeManifest({ modelId: "bad", version: "1", assets: [{ ...asset, bytes: 0 }] })).toThrow(/bytes/);
    expect(() => parseRuntimeManifest({ modelId: "bad", version: "1", assets: [{ ...asset, sha256: "bad" }] })).toThrow(/sha256/);
    expect(() => parseRuntimeManifest({ modelId: "bad", version: "1", assets: [{ ...asset, role: "rec", decoder: undefined, preprocessing: undefined }] })).toThrow(/decoder|preprocessing/);
  });
});
