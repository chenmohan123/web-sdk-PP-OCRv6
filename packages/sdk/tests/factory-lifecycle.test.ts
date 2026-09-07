import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicDetector, createPublicOCR, createPublicRecognizer, clearEveryModelCache } from "../src/factory";
import { PPOCRv6Error } from "../src/errors";
import { createInferenceExecutor, type InferenceExecutor } from "../src/runtime/executor";
import type { ModelManifest, RuntimeOptions } from "../src/types";

vi.mock("../src/runtime/executor", () => ({ createInferenceExecutor: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const modelBytes = new Uint8Array([1, 2, 3]);
const modelHash = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";
const executor = (): InferenceExecutor => ({ sessionMs: 0, run: vi.fn(), dispose: vi.fn().mockResolvedValue(undefined) });
const options = (dictionary?: string): RuntimeOptions => {
  const manifest: ModelManifest = {
    id: "lifecycle", modelId: "lifecycle", version: "1.0.0",
    assets: (["det", "rec"] as const).map((role) => ({
      id: role, role, preset: "small", bytes: 3, sha256: modelHash, url: `https://models.test/${role}.onnx`,
      input: { name: "x", dtype: "float32", shape: [1, 3, "H", "W"] },
      output: { name: "output", dtype: "float32", shape: role === "rec" ? [1, 3, 2] : [1, 1, 8, 8] },
      preprocessing: {}, postprocessing: {}, decoder: dictionary ? { dictionary } : { characters: ["A"] },
    })),
  };
  return { backend: "wasm", execution: "main", model: { det: { manifest }, rec: { manifest } } };
};

beforeEach(() => {
  vi.mocked(createInferenceExecutor).mockReset();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(modelBytes)));
});
afterEach(async () => { await clearEveryModelCache(); vi.unstubAllGlobals(); });

describe("公开工厂的初始化资源生命周期", () => {
  it("识别字典下载失败后释放已创建的执行器", async () => {
    const handle = executor();
    vi.mocked(createInferenceExecutor).mockResolvedValue(handle);
    vi.mocked(fetch).mockImplementation(async (url) => new Response(String(url).endsWith("dict.txt") ? null : modelBytes, { status: String(url).endsWith("dict.txt") ? 500 : 200 }));
    const recognizer = createPublicRecognizer(options("https://models.test/dict.txt"));
    await expect(recognizer.load()).rejects.toMatchObject({ code: "MODEL_DOWNLOAD_FAILED" });
    await recognizer.dispose();
    expect(handle.dispose).toHaveBeenCalledOnce();
  });

  it.each([["det", createPublicDetector], ["rec", createPublicRecognizer]] as const)("初始化中释放会等待并回收迟到的执行器：%s", async (_role, factory) => {
    const started = deferred<void>();
    const creating = deferred<InferenceExecutor>();
    const handle = executor();
    vi.mocked(createInferenceExecutor).mockImplementation(() => { started.resolve(); return creating.promise; });
    const component = factory(options());
    const loading = component.load();
    const loadError = loading.catch((error: unknown) => error);
    await started.promise;
    const disposing = component.dispose();
    creating.resolve(handle);
    await disposing;
    expect(await loadError).toMatchObject({ code: "DISPOSED" });
    await component.dispose();
    expect(handle.dispose).toHaveBeenCalledOnce();
  });

  it("字典下载中释放会取消请求并回收会话", async () => {
    const started = deferred<void>();
    const handle = executor();
    vi.mocked(createInferenceExecutor).mockResolvedValue(handle);
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (!String(url).endsWith("dict.txt")) return new Response(modelBytes);
      started.resolve();
      return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("已取消", "AbortError")), { once: true }));
    });
    const recognizer = createPublicRecognizer(options("https://models.test/dict.txt"));
    const loading = recognizer.load().catch((error: unknown) => error);
    await started.promise;
    await recognizer.dispose();
    expect(await loading).toMatchObject({ code: "ABORTED" });
    expect(handle.dispose).toHaveBeenCalledOnce();
  });

  it("外部信号在会话创建期间取消后回收迟到的执行器", async () => {
    const started = deferred<void>();
    const creating = deferred<InferenceExecutor>();
    const handle = executor();
    const controller = new AbortController();
    vi.mocked(createInferenceExecutor).mockImplementation(() => { started.resolve(); return creating.promise; });
    const detector = createPublicDetector({ ...options(), signal: controller.signal });
    const loading = detector.load().catch((error: unknown) => error);
    await started.promise;
    controller.abort();
    creating.resolve(handle);
    expect(await loading).toMatchObject({ code: "ABORTED" });
    await detector.dispose();
    expect(handle.dispose).toHaveBeenCalledOnce();
  });

  it("OCR 一路初始化失败后释放另一路尚在创建的会话", async () => {
    const creating = deferred<InferenceExecutor>();
    const started = deferred<void>();
    const handle = executor();
    vi.mocked(createInferenceExecutor)
      .mockImplementationOnce(async () => { await started.promise; throw new PPOCRv6Error("SESSION_CREATE_FAILED", "创建失败"); })
      .mockImplementationOnce(() => { started.resolve(); return creating.promise; });
    const ocr = createPublicOCR(options());
    await expect(ocr.load()).rejects.toMatchObject({ code: "SESSION_CREATE_FAILED" });
    const disposing = ocr.dispose();
    creating.resolve(handle);
    await disposing;
    expect(handle.dispose).toHaveBeenCalledOnce();
  });
});
