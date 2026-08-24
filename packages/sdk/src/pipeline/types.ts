import type { RasterImage } from "../detector/decode";
import type { Detector, ModelInfo, Recognizer, RuntimeInfo } from "../types";

export interface OCRPipelineComponents {
  readonly detector: Detector;
  readonly recognizer: Recognizer;
  readonly decode: (input: unknown) => Promise<RasterImage>;
  readonly model: ModelInfo;
  readonly runtime: RuntimeInfo;
  readonly readingOrderTolerance?: number;
}
