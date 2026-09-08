import { currentLoadTimings } from "./timing";
import { createIndexedDBCache } from "./cache/indexeddb-cache";
import { createDetectorEngine } from "./detector/detector";
import { decodeImage } from "./detector/decode";
import { PPOCRv6Error } from "./errors";
import { parseRuntimeManifest, type RuntimeManifest, type RuntimeManifestAsset } from "./model/manifest";
import { createModelManager } from "./model/model-manager";
import { createOCRPipeline } from "./pipeline/ocr";
import { createRecognizerEngine } from "./recognizer/recognizer";
import { validateRecognitionDictionary } from "./recognizer/dictionary";
import { probeCapabilities } from "./runtime/capabilities";
import { createInferenceExecutor, type InferenceExecutor } from "./runtime/executor";
import { createProgressReporter, safeEmitProgress, type ProgressReporter } from "./progress";
import { selectExecutionPlan } from "./runtime/select-plan";
import type { CustomModel, Detector, ModelInfo, ModelPreset, ModelVariant, OCRPipeline, Recognizer, RuntimeInfo, RuntimeOptions } from "./types";

export const DEFAULT_MANIFEST_URL = "https://chenmohan123.github.io/web-sdk-PP-OCRv6/models/pp-ocrv6/manifest.json?v=1.0.0";
const DEFAULT_VERSION = "1.0.0";
const defaultCache = createIndexedDBCache();

const isCustom = (selection: ModelVariant): selection is CustomModel => typeof selection === "object";
const asPreset = (selection: ModelVariant | undefined): ModelPreset => typeof selection === "string" ? selection : "small";
const checkAborted = (signal?: AbortSignal): void => { if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Model loading aborted"); };

async function fetchManifest(url: string, signal?: AbortSignal, onProgress?: (event: Parameters<NonNullable<RuntimeOptions["onProgress"]>>[0]) => void): Promise<RuntimeManifest> {
  safeEmitProgress(onProgress, { phase: "manifest", progress: 0 });
  let response: Response;
  try { response = await fetch(url, signal === undefined ? {} : { signal }); }
  catch (error) {
    if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Manifest download aborted");
    throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", error instanceof Error ? error.message : String(error), { url });
  }
  if (!response.ok) throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", `Manifest download failed with HTTP ${response.status}`, { url, status: response.status });
  try {
    const manifest = parseRuntimeManifest(await response.json(), url);
    safeEmitProgress(onProgress, { phase: "manifest", progress: 1 });
    return manifest;
  }
  catch (error) { if (error instanceof PPOCRv6Error) throw error; throw new PPOCRv6Error("INVALID_MANIFEST", error instanceof Error ? error.message : String(error)); }
}

async function resolveManifest(selection: ModelVariant | undefined, signal?: AbortSignal, onProgress?: RuntimeOptions["onProgress"]): Promise<{ manifest: RuntimeManifest; manifestUrl?: string; preset: ModelPreset }> {
  if (selection && isCustom(selection)) {
    if ("manifestUrl" in selection) return { manifest: await fetchManifest(selection.manifestUrl, signal, onProgress), manifestUrl: selection.manifestUrl, preset: selection.preset ?? "small" };
    safeEmitProgress(onProgress, { phase: "manifest", progress: 0 });
    safeEmitProgress(onProgress, { phase: "manifest", progress: 1 });
    return { manifest: parseRuntimeManifest(selection.manifest), preset: selection.preset ?? "small" };
  }
  return { manifest: await fetchManifest(DEFAULT_MANIFEST_URL, signal, onProgress), manifestUrl: DEFAULT_MANIFEST_URL, preset: asPreset(selection) };
}

async function resolveAsset(role: "det" | "rec", selection: ModelVariant | undefined, signal?: AbortSignal, onProgress?: RuntimeOptions["onProgress"]): Promise<{ manifest: RuntimeManifest; asset: RuntimeManifestAsset; manifestUrl?: string; preset: ModelPreset }> {
  const resolved = await resolveManifest(selection, signal, onProgress);
  // 多模型清单按 preset 选择；没有 preset 的旧式单模型清单仍取唯一角色资产。
  const asset = resolved.manifest.assets.find((candidate) => candidate.role === role && (candidate.preset === undefined || candidate.preset === resolved.preset));
  if (!asset) throw new PPOCRv6Error("INVALID_MANIFEST", `Manifest has no ${role} asset for preset ${resolved.preset}`);
  return { ...resolved, asset };
}

async function loadDictionary(asset: RuntimeManifestAsset, manifestUrl: string | undefined, signal?: AbortSignal): Promise<readonly string[]> {
  const decoder = asset.decoder ?? {};
  if (Array.isArray(decoder.characters) && decoder.characters.every((value) => typeof value === "string")) return validateRecognitionDictionary(asset, decoder.characters as string[]);
  if (typeof decoder.dictionary !== "string") throw new PPOCRv6Error("INVALID_MANIFEST", `Recognition asset ${asset.id} does not declare a dictionary`);
  let url: string;
  try { url = new URL(decoder.dictionary, manifestUrl).toString(); }
  catch { throw new PPOCRv6Error("INVALID_MANIFEST", "A relative recognition dictionary requires a manifest URL"); }
  let response: Response;
  try { response = await fetch(url, signal === undefined ? {} : { signal }); }
  catch (error) { throw new PPOCRv6Error(signal?.aborted ? "ABORTED" : "MODEL_DOWNLOAD_FAILED", error instanceof Error ? error.message : String(error), { url }); }
  if (!response.ok) throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", `Dictionary download failed with HTTP ${response.status}`, { url, status: response.status });
  const lines = (await response.text()).replace(/\r/g, "").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return validateRecognitionDictionary(asset, lines);
}

const modelInfo = (manifest: RuntimeManifest, asset: RuntimeManifestAsset, preset: ModelPreset, manifestUrl?: string): ModelInfo => ({ id: manifest.modelId, version: manifest.version, preset, ...(manifestUrl === undefined ? {} : { manifestUrl }), component: asset.id, bytes: asset.bytes, ...(typeof asset.parameterCount === "number" ? { parameterCount: asset.parameterCount } : {}) });

async function prepare(options: RuntimeOptions, role: "det" | "rec", reporter: ProgressReporter): Promise<{ asset: RuntimeManifestAsset; model: ModelInfo; runtime: RuntimeInfo; loaded: Awaited<ReturnType<ReturnType<typeof createModelManager>["load"]>>; executor: InferenceExecutor; sessionMs: number; manifestUrl?: string }> {
  const writeCache = defaultCache.createWriter?.();
  const selection = options.model?.[role];
  const resolved = await resolveAsset(role, selection, options.signal, (event) => reporter.emit(role, event));
  reporter.register(role, resolved.asset.bytes);
  const plan = selectExecutionPlan(options, probeCapabilities());
  const loaded = await createModelManager({ cache: defaultCache, ...(writeCache === undefined ? {} : { writeCache }), onProgress: (event) => reporter.emit(role, event), onSource: (source) => reporter.markSource(role, source) }).load({ modelId: resolved.manifest.modelId, version: resolved.manifest.version, variant: resolved.asset.id, bytes: resolved.asset.bytes, sha256: resolved.asset.sha256, url: resolved.asset.url }, options.signal);
  const sessionStarted = performance.now();
  let executor: InferenceExecutor | undefined;
  let actualBackend = plan.candidates[0]!;
  let lastError: unknown;
  for (const backend of plan.candidates) {
    checkAborted(options.signal);
    try {
      executor = await createInferenceExecutor({ model: loaded.bytes, backend, execution: plan.execution, ...(options.wasmPaths === undefined ? {} : { wasmPaths: options.wasmPaths }), onProgress: (progress) => reporter.emit(role, { phase: progress.phase === "session" ? "load" : "inference", ...(progress.progress === undefined ? {} : { progress: progress.progress }) }) });
      actualBackend = backend;
      break;
    }
    catch (error) { lastError = error; }
  }
  if (!executor) throw lastError;
  return {
    asset: resolved.asset,
    model: modelInfo(resolved.manifest, resolved.asset, resolved.preset, resolved.manifestUrl),
    runtime: { requestedBackend: plan.requestedBackend, actualBackend, execution: plan.execution, runtimeVersion: "onnxruntime-web@1.27.0" },
    loaded,
    executor,
    sessionMs: performance.now() - sessionStarted,
    ...(resolved.manifestUrl === undefined ? {} : { manifestUrl: resolved.manifestUrl }),
  };
}

export function createPublicDetector(options: RuntimeOptions = {}, progressReporter?: ProgressReporter): Detector {
  let delegate: Detector | undefined;
  let setup: Promise<Detector> | undefined;
  let disposal: Promise<void> | undefined;
  let disposed = false;
  const controller = new AbortController();
  const ready = () => {
    if (disposed) return Promise.reject(new PPOCRv6Error("DISPOSED", "Detector is disposed"));
    if (setup) return setup;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const reporter = progressReporter ?? createProgressReporter(options.onProgress, ["det"]);
    setup = prepare({ ...options, signal: controller.signal }, "det", reporter).then(async (prepared) => {
      try {
        if (disposed) throw new PPOCRv6Error("DISPOSED", "Detector is disposed");
        checkAborted(controller.signal);
        const engine = createDetectorEngine({ asset: prepared.asset, model: prepared.model, runtime: prepared.runtime, initialization: { ...prepared.loaded.timings, sessionMs: prepared.sessionMs, source: prepared.loaded.source }, loadModel: async () => ({ bytes: prepared.loaded.bytes, timings: prepared.loaded.timings }), createExecutor: async () => prepared.executor });
        await engine.load();
        if (disposed) throw new PPOCRv6Error("DISPOSED", "Detector is disposed");
        checkAborted(controller.signal);
        delegate = engine;
        return engine;
      } catch (error) {
        await prepared.executor.dispose();
        throw error;
      }
    }).finally(() => options.signal?.removeEventListener("abort", abort));
    return setup;
  };
  return { kind: "detector", get initialization() { return delegate?.initialization; }, async load() { await ready(); }, async detect(input, runOptions) {
    const started = performance.now();
    const cold = !delegate;
    const ownsInitialization = !setup;
    const engine = await ready();
    const result = await engine.detect(input, runOptions);
    return { ...result, timings: { ...result.timings, ...currentLoadTimings(engine.initialization, ownsInitialization), loadState: cold ? "cold" : "warm", totalMs: performance.now() - started } };
  }, dispose() {
    if (disposal) return disposal;
    disposed = true;
    controller.abort();
    disposal = (async () => {
      // 初始化尚未交出资源时，由 setup 的失败分支释放迟到的执行器。
      await setup?.catch(() => undefined);
      await delegate?.dispose();
      delegate = undefined;
    })();
    return disposal;
  } };
}

export function createPublicRecognizer(options: RuntimeOptions = {}, progressReporter?: ProgressReporter): Recognizer {
  let delegate: Recognizer | undefined;
  let setup: Promise<Recognizer> | undefined;
  let disposal: Promise<void> | undefined;
  let disposed = false;
  const controller = new AbortController();
  const ready = () => {
    if (disposed) return Promise.reject(new PPOCRv6Error("DISPOSED", "Recognizer is disposed"));
    if (setup) return setup;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const reporter = progressReporter ?? createProgressReporter(options.onProgress, ["rec"]);
    setup = prepare({ ...options, signal: controller.signal }, "rec", reporter).then(async (prepared) => {
      try {
        if (disposed) throw new PPOCRv6Error("DISPOSED", "Recognizer is disposed");
        checkAborted(controller.signal);
        const dictionary = await loadDictionary(prepared.asset, prepared.manifestUrl, controller.signal);
        if (disposed) throw new PPOCRv6Error("DISPOSED", "Recognizer is disposed");
        checkAborted(controller.signal);
        const engine = createRecognizerEngine({ asset: prepared.asset, dictionary, model: prepared.model, runtime: prepared.runtime, initialization: { ...prepared.loaded.timings, sessionMs: prepared.sessionMs, source: prepared.loaded.source }, loadModel: async () => ({ bytes: prepared.loaded.bytes, timings: prepared.loaded.timings }), createExecutor: async () => prepared.executor });
        await engine.load();
        if (disposed) throw new PPOCRv6Error("DISPOSED", "Recognizer is disposed");
        checkAborted(controller.signal);
        delegate = engine;
        return engine;
      } catch (error) {
        await prepared.executor.dispose();
        throw error;
      }
    }).finally(() => options.signal?.removeEventListener("abort", abort));
    return setup;
  };
  return { kind: "recognizer", get initialization() { return delegate?.initialization; }, async load() { await ready(); }, async recognize(input, runOptions) {
    const started = performance.now();
    const cold = !delegate;
    const ownsInitialization = !setup;
    const engine = await ready();
    const result = await engine.recognize(input, runOptions);
    return { ...result, timings: { ...result.timings, ...currentLoadTimings(engine.initialization, ownsInitialization), loadState: cold ? "cold" : "warm", totalMs: performance.now() - started } };
  }, dispose() {
    if (disposal) return disposal;
    disposed = true;
    controller.abort();
    disposal = (async () => {
      await setup?.catch(() => undefined);
      await delegate?.dispose();
      delegate = undefined;
    })();
    return disposal;
  } };
}

export function createPublicOCR(options: RuntimeOptions = {}): OCRPipeline {
  const reporter = createProgressReporter(options.onProgress, ["det", "rec"]);
  const detector = createPublicDetector(options, reporter);
  const recognizer = createPublicRecognizer(options, reporter);
  const model: ModelInfo = { id: "pp-ocrv6", version: DEFAULT_VERSION };
  const plan = (() => { try { return selectExecutionPlan(options, probeCapabilities()); } catch { return undefined; } })();
  const runtime: RuntimeInfo = { requestedBackend: options.backend ?? "wasm", actualBackend: plan?.candidates[0] ?? "wasm", execution: options.execution ?? "worker", runtimeVersion: "onnxruntime-web@1.27.0" };
  return createOCRPipeline({ detector, recognizer, decode: decodeImage, model, runtime });
}

export async function clearCurrentModelCache(modelId = "pp-ocrv6", version = DEFAULT_VERSION): Promise<void> { await defaultCache.clearCurrent(modelId, version); }
export async function clearEveryModelCache(): Promise<void> { await defaultCache.clearAll(); }

/** 返回本 SDK 实际缓存的模型字节；不包含同源其他应用的存储。 */
export async function getModelCacheUsage(modelId?: string, version?: string): Promise<{ readonly usage?: number; readonly quota?: number }> { return await defaultCache.estimate?.(modelId, version) ?? {}; }

/** 按当前选项解析模型身份，不下载模型、不创建会话。 */
export async function resolveModelCacheIdentity(selection?: ModelVariant, signal?: AbortSignal): Promise<{ modelId: string; version: string }> {
  const { manifest } = await resolveManifest(selection, signal);
  return { modelId: manifest.modelId, version: manifest.version };
}
