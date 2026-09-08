import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEveryModelCache, createPublicDetector, createPublicOCR, createPublicRecognizer } from "../src/factory";
import { createInferenceExecutor } from "../src/runtime/executor";
import type { ModelManifest, RuntimeOptions } from "../src/types";

vi.mock("../src/runtime/executor", () => ({ createInferenceExecutor: vi.fn() }));
vi.mock("../src/runtime/capabilities", () => ({ probeCapabilities: () => ({ wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: true, offscreenCanvas: true }) }));
const manifest: ModelManifest = {
  id: "timing-test", modelId: "timing-test", version: "1",
  assets: (["det", "rec"] as const).map((role, index) => ({
    id: role, role, bytes: 1, sha256: createHash("sha256").update(new Uint8Array([index + 1])).digest("hex"), url: "https://timing.test/" + role + ".onnx",
    input: { name: "x", dtype: "float32", shape: [1, 3, "H", "W"] },
    output: { name: "y", dtype: "float32", shape: role === "det" ? [1, 1, 1, 1] : [1, 1, 2] },
    preprocessing: { resize: { height: 1, width: 2 } }, postprocessing: { minSize: 1 }, decoder: { characters: ["A"] },
  })),
};
const raster = { width: 8, height: 8, data: new Uint8ClampedArray(256) };
beforeEach(() => {
  vi.mocked(createInferenceExecutor).mockReset().mockImplementation(async (configuration) => {
    if (configuration.backend === "webgpu") throw new Error("模拟 WebGPU 会话创建失败");
    const detection = configuration.model[0] === 1;
    return { sessionMs: 20, dispose: async () => {}, run: async () => ({ y: { data: new Float32Array(detection ? [0.9] : [0, 1]), dims: detection ? [1, 1, 1, 1] : [1, 1, 2] } }) };
  });
  vi.stubGlobal("fetch", async (url: string) => new Response(new Uint8Array([String(url).includes("det") ? 1 : 2])));
});
afterEach(async () => { await clearEveryModelCache(); vi.unstubAllGlobals(); });
describe.each(["main", "worker"] as const)("公开工厂耗时与回退结果：%s", (execution) => {
  it("运行中途加入显式初始化时，仅记录本次剩余等待", async () => {
    let now = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(createInferenceExecutor).mockImplementation(async () => {
      enter();
      await pending;
      return { sessionMs: now, dispose: async () => {}, run: async () => ({ y: { data: new Float32Array([0]), dims: [1, 1, 1, 1] } }) };
    });
    const detector = createPublicDetector({ backend: "wasm", execution, model: { det: { manifest } } });
    try {
      const loading = detector.load();
      await entered;
      now = 100;
      const resultPromise = detector.detect(raster);
      now = 110;
      release();
      await loading;
      const result = await resultPromise;
      expect(result.timings).toMatchObject({ loadState: "cold", sessionMs: 0, totalMs: 10, initialization: { sessionMs: 110 } });
    } finally { await detector.dispose(); clock.mockRestore(); }
  });
  it("新实例命中模型缓存仍需冷初始化，热运行不重复累计", async () => {
    const options: RuntimeOptions = { backend: "wasm", execution, model: { det: { manifest } } };
    const first = createPublicDetector(options);
    await first.load();
    await first.dispose();
    const cached = createPublicDetector(options);
    try {
      const cold = await cached.detect(raster);
      expect(cold.timings).toMatchObject({ loadState: "cold", modelDownloadMs: 0, initialization: { source: "cache" } });
      expect(cold.timings.sessionMs).toBeGreaterThan(0);
      const warm = await cached.detect(raster);
      expect(warm.timings).toMatchObject({ loadState: "warm", modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, initialization: cold.timings.initialization });
    } finally { await cached.dispose(); }
  });

  it.each(["detector", "recognizer", "ocr"] as const)("%s 显式加载后的首轮按热运行计，仍保留初始化记录", async (kind) => {
    const options: RuntimeOptions = { backend: "wasm", execution, model: { det: { manifest }, rec: { manifest } } };
    const component = kind === "detector" ? createPublicDetector(options) : kind === "recognizer" ? createPublicRecognizer(options) : createPublicOCR(options);
    try {
      await component.load();
      const result = component.kind === "detector" ? await component.detect(raster) : component.kind === "recognizer" ? await component.recognize(raster) : await component.ocr(raster);
      expect(result.timings).toMatchObject({ modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, loadState: "warm" });
      expect(result.timings.initialization?.sessionMs).toBeGreaterThan(0);
    } finally { await component.dispose(); }
  });
  it.each(["detector", "recognizer", "ocr"] as const)("%s 的第二次运行不重复报告加载，实际后端来自成功会话", async (kind) => {
    const options: RuntimeOptions = { backend: "auto", execution, allowFallback: true, model: { det: { manifest }, rec: { manifest } } };
    const component = kind === "detector" ? createPublicDetector(options) : kind === "recognizer" ? createPublicRecognizer(options) : createPublicOCR(options);
    const run = () => component.kind === "detector" ? component.detect(raster) : component.kind === "recognizer" ? component.recognize(raster) : component.ocr(raster);
    try {
      const first = await run();
      expect(first.runtime).toMatchObject({ requestedBackend: "auto", actualBackend: "wasm", execution });
      expect(first.timings.sessionMs).toBeGreaterThan(0);
      const second = await run();
      expect(second.timings).toMatchObject({ modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, loadState: "warm" });
      expect(second.runtime.actualBackend).toBe("wasm");
    } finally { await component.dispose(); }
  });
});
