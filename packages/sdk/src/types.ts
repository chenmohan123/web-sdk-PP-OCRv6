export type Backend = "wasm" | "webgpu" | "auto";
export type ExecutionMode = "worker" | "main";
export type ModelPreset = "medium" | "small" | "tiny";
export interface ModelManifest { readonly id: string; readonly version: string; readonly components?: readonly string[]; readonly [key: string]: unknown; }
export type ModelSource = ModelManifest | { readonly manifestUrl: string } | ModelPreset;
export interface RuntimeOptions { readonly backend?: Backend; readonly execution?: ExecutionMode; readonly allowFallback?: boolean; readonly model?: ModelSource; readonly signal?: AbortSignal; }
export interface Detector { readonly kind: "detector"; load(): Promise<void>; detect(input: unknown): Promise<DetectionResult>; dispose(): void; }
export interface Recognizer { readonly kind: "recognizer"; load(): Promise<void>; recognize(input: unknown): Promise<RecognitionResult>; dispose(): void; }
export interface OCRPipeline { readonly kind: "ocr"; load(): Promise<void>; recognize(input: unknown): Promise<OCRResult>; dispose(): void; }
export interface Point { readonly x: number; readonly y: number; }
export interface Detection { readonly index: number; readonly polygon: readonly Point[]; readonly score: number; }
export interface DetectionResult { readonly detections: readonly Detection[]; readonly timing: Timing; }
export interface Recognition { readonly index: number; readonly text: string; readonly score: number; }
export interface RecognitionResult { readonly recognitions: readonly Recognition[]; readonly timing: Timing; }
export interface OCRLine extends Detection, Recognition {}
export interface OCRResult { readonly lines: readonly OCRLine[]; readonly timing: Timing; }
export interface Timing { readonly totalMs: number; readonly requestedBackend: Backend; readonly actualBackend?: Exclude<Backend, "auto">; readonly execution: ExecutionMode; }
export interface Capabilities { readonly wasm: boolean; readonly webgpu: boolean; readonly worker: boolean; }
