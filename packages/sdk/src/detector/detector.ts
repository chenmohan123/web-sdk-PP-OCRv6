import { PPOCRv6Error } from "../errors";
import type { RuntimeManifestAsset } from "../model/manifest";
import type { DetectionResult, Detector, ModelInfo, RuntimeInfo, TimingBreakdown } from "../types";
import { decodeImage, type RasterImage } from "./decode";
import { postprocessDetection } from "./postprocess";
import { preprocessDetection } from "./preprocess";

export interface InferenceTensor { readonly data: Float32Array; readonly dims: readonly number[]; }
export interface DetectorExecutor {
  readonly sessionMs: number;
  run(inputName: string, data: Float32Array, dims: readonly number[], signal?: AbortSignal): Promise<Record<string, InferenceTensor>>;
  dispose(): Promise<void> | void;
}
export interface DetectorEngineOptions {
  readonly asset: RuntimeManifestAsset;
  readonly model: ModelInfo;
  readonly runtime: RuntimeInfo;
  readonly loadModel: () => Promise<{ readonly bytes: Uint8Array; readonly timings: Pick<TimingBreakdown, "modelDownloadMs" | "modelCacheReadMs" | "integrityMs"> }>;
  readonly createExecutor: (bytes: Uint8Array) => Promise<DetectorExecutor>;
  readonly decode?: (input: unknown) => Promise<RasterImage>;
}

const elapsed = (started: number): number => performance.now() - started;
const numberOption = (record: Record<string, unknown>, key: string, fallback: number): number => typeof record[key] === "number" ? record[key] : fallback;
const emptyLoadTimings = { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0 };

export function createDetectorEngine(options: DetectorEngineOptions): Detector {
  let executor: DetectorExecutor | undefined;
  let loadTimings = emptyLoadTimings;
  let loadPromise: Promise<void> | undefined;
  let disposed = false;
  let queue = Promise.resolve();
  const load = (): Promise<void> => {
    if (disposed) return Promise.reject(new PPOCRv6Error("DISPOSED", "Detector is disposed"));
    if (executor) return Promise.resolve();
    loadPromise ??= (async () => {
      const loaded = await options.loadModel();
      if (disposed) throw new PPOCRv6Error("DISPOSED", "Detector is disposed");
      loadTimings = loaded.timings;
      executor = await options.createExecutor(loaded.bytes);
    })().catch((error) => { loadPromise = undefined; throw error; });
    return loadPromise;
  };
  const run = async (input: unknown, signal?: AbortSignal): Promise<DetectionResult> => {
    if (disposed) throw new PPOCRv6Error("DISPOSED", "Detector is disposed");
    if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Detection aborted");
    const totalStarted = performance.now();
    await load();
    const decodeStarted = performance.now();
    const image = await (options.decode ?? decodeImage)(input);
    const decodeMs = elapsed(decodeStarted);
    if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Detection aborted");
    const preprocessStarted = performance.now();
    const tensor = preprocessDetection(image);
    const preprocessMs = elapsed(preprocessStarted);
    const inferenceStarted = performance.now();
    const output = await executor!.run(options.asset.input.name, tensor.data, tensor.dims, signal);
    const inferenceMs = elapsed(inferenceStarted);
    const outputTensor = output[options.asset.output.name];
    if (!outputTensor) throw new PPOCRv6Error("INFERENCE_FAILED", `Missing detection output tensor: ${options.asset.output.name}`);
    const post = options.asset.postprocessing ?? {};
    const postprocessStarted = performance.now();
    const detections = postprocessDetection(outputTensor, {
      originalWidth: image.width,
      originalHeight: image.height,
      threshold: numberOption(post, "thresh", 0.2),
      boxThreshold: numberOption(post, "boxThresh", 0.45),
      unclipRatio: numberOption(post, "unclipRatio", 1.4),
      minSize: numberOption(post, "minSize", 3),
      maxCandidates: numberOption(post, "maxCandidates", 3000),
    });
    const postprocessMs = elapsed(postprocessStarted);
    return {
      detections,
      image: { width: image.width, height: image.height, source: image.source },
      model: options.model,
      runtime: options.runtime,
      timings: {
        ...loadTimings,
        sessionMs: executor!.sessionMs,
        decodeMs,
        preprocessMs,
        inferenceMs,
        postprocessMs,
        totalMs: elapsed(totalStarted),
      },
    };
  };
  return {
    kind: "detector",
    load,
    detect(input, runOptions) {
      const result = queue.then(() => run(input, runOptions?.signal));
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await queue;
      await executor?.dispose();
      executor = undefined;
    },
  };
}
