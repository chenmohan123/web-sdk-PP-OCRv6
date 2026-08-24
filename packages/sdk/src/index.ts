import { PPOCRv6Error } from "./errors";
import type { Capabilities, Detector, OCRPipeline, Recognizer, RuntimeOptions } from "./types";

const unimplemented = (kind: string): never => { throw new PPOCRv6Error("INVALID_MANIFEST", `${kind} requires a validated model manifest`); };
export const createDetector = (_options: RuntimeOptions = {}): Detector => unimplemented("Detector");
export const createRecognizer = (_options: RuntimeOptions = {}): Recognizer => unimplemented("Recognizer");
export const createOCR = (_options: RuntimeOptions = {}): OCRPipeline => unimplemented("OCR pipeline");
export const clearModelCache = async (_modelId?: string): Promise<void> => {};
export const clearAllModelCache = async (): Promise<void> => {};
export const probeCapabilities = (): Capabilities => ({ wasm: typeof WebAssembly !== "undefined", webgpu: "gpu" in navigator, worker: typeof Worker !== "undefined" });
export { PPOCRv6Error } from "./errors";
export type { ErrorCode } from "./errors";
export type * from "./types";
