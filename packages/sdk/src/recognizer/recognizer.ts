import type { RasterImage } from "../detector/decode";
import type { InferenceTensor } from "../detector/detector";
import { PPOCRv6Error } from "../errors";
import type { RuntimeManifestAsset } from "../model/manifest";
import type { ModelInfo, Recognizer, RecognitionResult, RuntimeInfo, TimingBreakdown } from "../types";
import type { IndexedCrop } from "./crop";
import { decodeCTC, decodeNRTR } from "./decode";
import { preprocessRecognition } from "./preprocess";

export interface RecognizerExecutor {
  readonly sessionMs: number;
  run(inputName: string, data: Float32Array, dims: readonly number[], signal?: AbortSignal): Promise<Record<string, InferenceTensor | { readonly data: Int32Array; readonly dims: readonly number[] }>>;
  dispose(): Promise<void> | void;
}
export interface RecognizerEngineOptions {
  readonly asset: RuntimeManifestAsset;
  readonly dictionary: readonly string[];
  readonly model: ModelInfo;
  readonly runtime: RuntimeInfo;
  readonly loadModel: () => Promise<{ readonly bytes: Uint8Array; readonly timings: Pick<TimingBreakdown, "modelDownloadMs" | "modelCacheReadMs" | "integrityMs"> }>;
  readonly createExecutor: (bytes: Uint8Array) => Promise<RecognizerExecutor>;
}

const isRaster = (value: unknown): value is RasterImage => typeof value === "object" && value !== null && typeof (value as RasterImage).width === "number" && (value as RasterImage).data instanceof Uint8ClampedArray;
const isCrop = (value: unknown): value is IndexedCrop => typeof value === "object" && value !== null && typeof (value as IndexedCrop).index === "number" && isRaster((value as IndexedCrop).image);
const numberValue = (value: unknown, fallback: number): number => typeof value === "number" ? value : fallback;
const numberArray = (value: unknown, fallback: readonly [number, number, number]): readonly [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number") ? value as [number, number, number] : fallback;
const scaleValue = (value: unknown): number => value === "1/255" ? 1 / 255 : numberValue(value, 1 / 255);

export function createRecognizerEngine(options: RecognizerEngineOptions): Recognizer {
  let executor: RecognizerExecutor | undefined;
  let loadPromise: Promise<void> | undefined;
  let loadTimings = { modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0 };
  let disposed = false;
  let queue = Promise.resolve();
  const load = (): Promise<void> => {
    if (disposed) return Promise.reject(new PPOCRv6Error("DISPOSED", "Recognizer is disposed"));
    if (executor) return Promise.resolve();
    loadPromise ??= (async () => {
      const loaded = await options.loadModel();
      if (disposed) throw new PPOCRv6Error("DISPOSED", "Recognizer is disposed");
      loadTimings = loaded.timings;
      executor = await options.createExecutor(loaded.bytes);
    })().catch((error) => { loadPromise = undefined; throw error; });
    return loadPromise;
  };
  const run = async (input: unknown, signal?: AbortSignal): Promise<RecognitionResult> => {
    if (disposed) throw new PPOCRv6Error("DISPOSED", "Recognizer is disposed");
    if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Recognition aborted");
    const crops: readonly IndexedCrop[] = isRaster(input) ? [{ index: 0, image: input }] : Array.isArray(input) && input.every(isCrop) ? input : [];
    if (crops.length === 0) throw new PPOCRv6Error("INVALID_INPUT", "Recognition requires an image or a non-empty crop batch");
    const totalStarted = performance.now();
    await load();
    const resize = typeof options.asset.preprocessing.resize === "object" && options.asset.preprocessing.resize !== null ? options.asset.preprocessing.resize as Record<string, unknown> : {};
    const normalize = typeof options.asset.preprocessing.normalize === "object" && options.asset.preprocessing.normalize !== null ? options.asset.preprocessing.normalize as Record<string, unknown> : {};
    const preprocessStarted = performance.now();
    const tensors = crops.map((crop) => preprocessRecognition(crop.image, {
      height: numberValue(resize.height, 48),
      width: numberValue(resize.width, 320),
      scale: scaleValue(normalize.scale),
      mean: numberArray(normalize.mean, [0.5, 0.5, 0.5]),
      std: numberArray(normalize.std, [0.5, 0.5, 0.5]),
    }));
    const [, channels, height, width] = tensors[0]!.dims;
    const itemLength = channels * height * width;
    const batch = new Float32Array(itemLength * tensors.length);
    tensors.forEach((tensor, index) => batch.set(tensor.data, index * itemLength));
    const preprocessMs = performance.now() - preprocessStarted;
    const inferenceStarted = performance.now();
    const outputs = await executor!.run(options.asset.input.name, batch, [tensors.length, channels, height, width], signal);
    const inferenceMs = performance.now() - inferenceStarted;
    const output = outputs[options.asset.output.name];
    if (!output) throw new PPOCRv6Error("INFERENCE_FAILED", `Missing recognition output tensor: ${options.asset.output.name}`);
    const decoder = options.asset.decoder ?? {};
    const postprocessStarted = performance.now();
    const name = typeof decoder.name === "string" ? decoder.name : "CTCLabelDecode";
    const decoded = name.toUpperCase().includes("NRTR")
      ? decodeNRTR(output.data as Int32Array, output.dims, options.dictionary, { bosIndex: numberValue(decoder.bosIndex, 0), eosIndex: numberValue(decoder.eosIndex, 1), padIndex: numberValue(decoder.padIndex, 2), tokenOffset: numberValue(decoder.tokenOffset, 3) })
      : decodeCTC(output.data as Float32Array, output.dims, options.dictionary, { blankIndex: numberValue(decoder.blankIndex, 0), probabilities: output.data.every((value) => value >= 0 && value <= 1) });
    const recognitions = decoded.map((item, index) => ({ index: crops[index]!.index, text: item.text, score: item.score }));
    const postprocessMs = performance.now() - postprocessStarted;
    const source = crops[0]!.image;
    return {
      recognitions,
      image: { width: source.width, height: source.height, source: source.source },
      model: options.model,
      runtime: options.runtime,
      timings: { ...loadTimings, sessionMs: executor!.sessionMs, decodeMs: 0, preprocessMs, inferenceMs, postprocessMs, totalMs: performance.now() - totalStarted },
    };
  };
  return {
    kind: "recognizer",
    load,
    recognize(input, runOptions) {
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
