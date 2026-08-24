import { PPOCRv6Error } from "../errors";
import type { Backend } from "../types";
import { transferableBuffers, type WorkerRequest, type WorkerResponse } from "./protocol";

interface WorkerLike extends EventTarget {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

export interface WorkerBridge {
  load(model: ArrayBufferLike, backend?: Exclude<Backend, "auto">): Promise<unknown>;
  run(input: ArrayBuffer | ArrayBufferView, signal?: AbortSignal): Promise<unknown>;
  dispose(): Promise<void>;
}

let nextId = 0;
const id = () => `ocrv6-${++nextId}`;

export function createWorkerBridge(worker: WorkerLike): WorkerBridge {
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: unknown): void }>();
  let disposed = false;
  const rejectAll = (error: PPOCRv6Error) => { for (const entry of pending.values()) entry.reject(error); pending.clear(); };
  const onMessage = (event: Event) => {
    const data = (event as MessageEvent<WorkerResponse>).data;
    if (!data?.requestId) return;
    const entry = pending.get(data.requestId);
    if (!entry) return;
    if (data.type === "progress") return;
    pending.delete(data.requestId);
    if (data.type === "error") entry.reject(new PPOCRv6Error(data.code, data.message, data.details));
    else entry.resolve(data.result);
  };
  const onError = (event: Event) => {
    const errorEvent = event as Event & { error?: unknown; message?: string };
    const message = errorEvent.message ?? (errorEvent.error instanceof Error ? errorEvent.error.message : "Worker failed");
    rejectAll(new PPOCRv6Error("INFERENCE_FAILED", message));
  };
  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onError);
  const request = (message: WorkerRequest, transfer: Transferable[], signal?: AbortSignal): Promise<unknown> => {
    if (disposed) return Promise.reject(new PPOCRv6Error("DISPOSED", "Worker bridge is disposed"));
    return new Promise((resolve, reject) => {
      const abort = () => { pending.delete(message.requestId); reject(new PPOCRv6Error("ABORTED", "Worker request aborted")); };
      if (signal?.aborted) return abort();
      signal?.addEventListener("abort", abort, { once: true });
      pending.set(message.requestId, { resolve(value) { signal?.removeEventListener("abort", abort); resolve(value); }, reject(error) { signal?.removeEventListener("abort", abort); reject(error); } });
      worker.postMessage(message, transfer);
    });
  };
  return {
    load(model, backend = "wasm") {
      const buffer = model instanceof ArrayBuffer ? model : new Uint8Array(model).slice().buffer;
      return request({ type: "load", requestId: id(), model: buffer, backend }, [buffer]);
    },
    run(input, signal) {
      const buffer = input instanceof ArrayBuffer ? input : new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice().buffer;
      return request({ type: "run", requestId: id(), input: buffer }, transferableBuffers(buffer), signal);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      const requestId = id();
      worker.postMessage({ type: "dispose", requestId } satisfies WorkerRequest);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      rejectAll(new PPOCRv6Error("DISPOSED", "Worker bridge is disposed"));
      worker.terminate();
    },
  };
}
