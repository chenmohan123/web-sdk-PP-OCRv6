import { decodeImage } from "../detector/decode";
import { sortDetectionsReadingOrder } from "../detector/reading-order";
import { PPOCRv6Error } from "../errors";
import { cropPolygon } from "../recognizer/crop";
import type { OCRPipeline, OCRResult, RunOptions, TimingBreakdown } from "../types";
import type { OCRPipelineComponents } from "./types";

const sumTimings = (left: TimingBreakdown, right: TimingBreakdown, totalMs: number): TimingBreakdown => ({
  modelDownloadMs: left.modelDownloadMs + right.modelDownloadMs,
  modelCacheReadMs: left.modelCacheReadMs + right.modelCacheReadMs,
  integrityMs: left.integrityMs + right.integrityMs,
  sessionMs: left.sessionMs + right.sessionMs,
  decodeMs: left.decodeMs + right.decodeMs,
  preprocessMs: left.preprocessMs + right.preprocessMs,
  inferenceMs: left.inferenceMs + right.inferenceMs,
  postprocessMs: left.postprocessMs + right.postprocessMs,
  totalMs,
});

export function createOCRPipeline(components: OCRPipelineComponents): OCRPipeline {
  let disposed = false;
  let queue = Promise.resolve();
  const load = async () => {
    if (disposed) throw new PPOCRv6Error("DISPOSED", "OCR pipeline is disposed");
    await Promise.all([components.detector.load(), components.recognizer.load()]);
  };
  const run = async (input: unknown, options: RunOptions = {}): Promise<OCRResult> => {
    if (disposed) throw new PPOCRv6Error("DISPOSED", "OCR pipeline is disposed");
    if (options.signal?.aborted) throw new PPOCRv6Error("ABORTED", "OCR pipeline aborted");
    const started = performance.now();
    const raster = await (components.decode ?? decodeImage)(input);
    const detectionStarted = performance.now();
    const detected = await components.detector.detect(raster, options);
    const detectionMs = performance.now() - detectionStarted;
    const cropStarted = performance.now();
    const ordered = sortDetectionsReadingOrder(detected.detections, components.readingOrderTolerance ?? 0.5);
    const crops = ordered.map((detection) => cropPolygon(raster, detection));
    const cropMs = performance.now() - cropStarted;
    if (options.signal?.aborted) throw new PPOCRv6Error("ABORTED", "OCR pipeline aborted");
    const recognitionStarted = performance.now();
    const recognized = crops.length === 0
      ? { recognitions: [], timings: { ...detected.timings, modelDownloadMs: 0, modelCacheReadMs: 0, integrityMs: 0, sessionMs: 0, totalMs: 0 } }
      : await components.recognizer.recognize(crops, options);
    const recognitionMs = performance.now() - recognitionStarted;
    const byIndex = new Map(recognized.recognitions.map((item) => [item.index, item]));
    const lines = ordered.map((detection) => {
      const recognition = byIndex.get(detection.index);
      if (!recognition) throw new PPOCRv6Error("INFERENCE_FAILED", `Missing recognition for detection ${detection.index}`);
      return { ...detection, text: recognition.text, recognitionScore: recognition.score };
    });
    const totalMs = performance.now() - started;
    return {
      lines,
      detections: detected.detections,
      image: { width: raster.width, height: raster.height, source: raster.source },
      model: components.model,
      runtime: components.runtime,
      timings: sumTimings(detected.timings, recognized.timings, totalMs),
      stageTimings: { detectionMs, cropMs, recognitionMs },
    };
  };
  return {
    kind: "ocr",
    load,
    ocr(input, options) {
      const result = queue.then(() => run(input, options));
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
    recognize(input, options) { return this.ocr(input, options); },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await queue;
      await Promise.all([components.detector.dispose(), components.recognizer.dispose()]);
    },
  };
}
