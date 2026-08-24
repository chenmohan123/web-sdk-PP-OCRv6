export type Backend = "wasm" | "webgpu" | "auto";
export type ExecutionMode = "worker" | "main";
export type ModelPreset = "medium" | "small" | "tiny";
export interface ModelManifest { readonly id: string; readonly version: string; readonly components?: readonly string[]; readonly [key: string]: unknown; }
export type CustomModel = { readonly manifest: ModelManifest } | { readonly manifestUrl: string };
export type ModelVariant = ModelPreset | CustomModel;
export interface ModelSelection { readonly det?: ModelVariant; readonly rec?: ModelVariant; }
export type ModelSource = ModelSelection;
export interface RuntimeOptions { readonly backend?: Backend; readonly execution?: ExecutionMode; readonly allowFallback?: boolean; readonly model?: ModelSelection; readonly signal?: AbortSignal; }
export interface Detector { readonly kind: "detector"; load(): Promise<void>; detect(input: unknown): Promise<DetectionResult>; dispose(): void; }
export interface Recognizer { readonly kind: "recognizer"; load(): Promise<void>; recognize(input: unknown): Promise<RecognitionResult>; dispose(): void; }
export interface OCRPipeline { readonly kind: "ocr"; load(): Promise<void>; ocr(input: unknown, options?: RuntimeOptions): Promise<OCRResult>; recognize(input: unknown, options?: RuntimeOptions): Promise<OCRResult>; dispose(): void; }
export interface Point { readonly x: number; readonly y: number; }
export interface Detection { readonly index: number; readonly polygon: readonly Point[]; readonly score: number; }
export interface ImageInfo { readonly width: number; readonly height: number; readonly source?: "image" | "canvas" | "bitmap" | "video"; }
export interface ModelInfo { readonly id: string; readonly version: string; readonly preset?: ModelPreset; readonly manifestUrl?: string; }
export interface RuntimeInfo { readonly requestedBackend: Backend; readonly actualBackend: Exclude<Backend, "auto">; readonly execution: ExecutionMode; readonly runtimeVersion: string; }
export interface TimingBreakdown {
  readonly modelDownloadMs: number;
  readonly modelCacheReadMs: number;
  readonly integrityMs: number;
  readonly sessionMs: number;
  readonly decodeMs: number;
  readonly preprocessMs: number;
  readonly inferenceMs: number;
  readonly postprocessMs: number;
  readonly totalMs: number;
}
export interface DetectionResult { readonly detections: readonly Detection[]; readonly image: ImageInfo; readonly model: ModelInfo; readonly runtime: RuntimeInfo; readonly timings: TimingBreakdown; }
export interface Recognition { readonly index: number; readonly text: string; readonly score: number; }
export interface RecognitionResult { readonly recognitions: readonly Recognition[]; readonly image: ImageInfo; readonly model: ModelInfo; readonly runtime: RuntimeInfo; readonly timings: TimingBreakdown; }
export interface OCRLine extends Detection, Recognition {}
export interface OCRResult { readonly lines: readonly OCRLine[]; readonly image: ImageInfo; readonly model: ModelInfo; readonly runtime: RuntimeInfo; readonly timings: TimingBreakdown; }
/** @deprecated Use RuntimeInfo and TimingBreakdown on public results. */
export interface Timing { readonly totalMs: number; readonly requestedBackend: Backend; readonly actualBackend?: Exclude<Backend, "auto">; readonly execution: ExecutionMode; }
export interface Capabilities {
  readonly wasm: boolean;
  readonly wasmSimd: boolean;
  readonly wasmThreads: boolean;
  readonly webgpu: boolean;
  readonly worker: boolean;
  readonly offscreenCanvas: boolean;
}
