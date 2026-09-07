import * as defaultOrt from "onnxruntime-web";
import { PPOCRv6Error } from "../errors";
import type { Backend, WasmPaths } from "../types";

type OrtSession = {
  run(feeds: Record<string, unknown>, options?: { terminate?: boolean }): Promise<Record<string, unknown>>;
  release(): Promise<void>;
};
type OrtModule = {
  readonly InferenceSession: { create(model: ArrayBufferLike, options?: Record<string, unknown>): Promise<OrtSession> };
  readonly env?: { readonly wasm?: Record<string, unknown> };
};

export interface OrtSessionProgress { readonly phase: "session" | "inference"; readonly progress?: number }
export interface OrtSessionOptions {
  readonly ort?: OrtModule;
  readonly backend: Exclude<Backend, "auto">;
  readonly model: ArrayBufferLike;
  readonly wasmPaths?: WasmPaths;
  readonly numThreads?: number;
  readonly onProgress?: (progress: OrtSessionProgress) => void;
}
export interface OrtSessionHandle {
  readonly backend: Exclude<Backend, "auto">;
  readonly sessionMs: number;
  run(feeds: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  dispose(): Promise<void>;
}

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const emitProgress = (callback: ((progress: OrtSessionProgress) => void) | undefined, progress: OrtSessionProgress): void => {
  try { callback?.(progress); } catch { /* 用户回调异常不能中断 runtime。 */ }
};
const translate = (error: unknown, phase: "create" | "run"): PPOCRv6Error => {
  if (error instanceof PPOCRv6Error) return error;
  const message = messageOf(error);
  if (error instanceof Error && error.name === "AbortError") return new PPOCRv6Error("ABORTED", message);
  if (/out of memory|memory allocation|allocation failed/i.test(message)) return new PPOCRv6Error("OUT_OF_MEMORY", message);
  return new PPOCRv6Error(phase === "create" ? "SESSION_CREATE_FAILED" : "INFERENCE_FAILED", message);
};

export async function createOrtSession(options: OrtSessionOptions): Promise<OrtSessionHandle> {
  const ort = (options.ort ?? defaultOrt) as unknown as OrtModule;
  if (options.wasmPaths !== undefined && ort.env?.wasm) ort.env.wasm.wasmPaths = options.wasmPaths;
  const executionProviders = [options.backend];
  const sessionOptions: Record<string, unknown> = { executionProviders };
  if (options.numThreads !== undefined) sessionOptions.intraOpNumThreads = options.numThreads;
  const started = performance.now();
  emitProgress(options.onProgress, { phase: "session", progress: 0 });
  let session: OrtSession;
  try {
    session = await ort.InferenceSession.create(options.model, sessionOptions);
  } catch (error) {
    throw translate(error, "create");
  }
  const sessionMs = performance.now() - started;
  emitProgress(options.onProgress, { phase: "session", progress: 1 });
  let disposed = false;
  let disposal: Promise<void> | undefined;
  let queue = Promise.resolve();
  return {
    backend: options.backend,
    sessionMs,
    async run(feeds, signal) {
      if (disposed) throw new PPOCRv6Error("DISPOSED", "ORT session is disposed");
      if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Inference aborted");
      let onAbort: (() => void) | undefined;
      const aborted = signal ? new Promise<never>((_, reject) => {
        onAbort = () => reject(new PPOCRv6Error("ABORTED", "Inference aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      }) : undefined;
      const runPromise = queue.then(async () => {
        if (disposed) throw new PPOCRv6Error("DISPOSED", "ORT session is disposed");
        if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Inference aborted");
        emitProgress(options.onProgress, { phase: "inference", progress: 0 });
        if (disposed) throw new PPOCRv6Error("DISPOSED", "ORT session is disposed");
        if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Inference aborted");
        return session.run(feeds, { terminate: false });
      });
      // 取消仅结束调用方等待；底层推理完成后才能重跑或释放会话。
      queue = runPromise.then(() => undefined, () => undefined);
      try {
        const result = aborted ? await Promise.race([runPromise, aborted]) : await runPromise;
        if (signal?.aborted) throw new PPOCRv6Error("ABORTED", "Inference aborted");
        emitProgress(options.onProgress, { phase: "inference", progress: 1 });
        return result;
      } catch (error) {
        if (error instanceof PPOCRv6Error) throw error;
        throw translate(error, "run");
      } finally {
        if (onAbort) signal?.removeEventListener("abort", onAbort);
      }
    },
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      disposal = queue.then(() => session.release());
      return disposal;
    },
  };
}
