import * as ort from "onnxruntime-web";
import { PPOCRv6Error } from "./errors";
import { createOrtSession, type OrtSessionHandle } from "./runtime/ort-session";
import type { WorkerRequest, WorkerResponse } from "./runtime/protocol";

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
let session: OrtSessionHandle | undefined;
let progressRequestId: string | undefined;
let queue = Promise.resolve();
const cancelled = new Set<string>();

const send = (message: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(message, transfer);
const errorMessage = (requestId: string, error: unknown): WorkerResponse => {
  const normalized = error instanceof PPOCRv6Error ? error : new PPOCRv6Error("INFERENCE_FAILED", error instanceof Error ? error.message : String(error));
  return normalized.details === undefined
    ? { type: "error", requestId, code: normalized.code, message: normalized.message }
    : { type: "error", requestId, code: normalized.code, message: normalized.message, details: normalized.details };
};

const handle = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "cancel") { cancelled.add(request.requestId); return; }
    if (request.type === "load") {
      await session?.dispose();
      progressRequestId = request.requestId;
      try {
        session = await createOrtSession({ ort: ort as never, backend: request.backend, model: request.model, onProgress: (progress) => send(progress.progress === undefined
          ? { type: "progress", requestId: progressRequestId ?? request.requestId, phase: progress.phase }
          : { type: "progress", requestId: progressRequestId ?? request.requestId, phase: progress.phase, progress: progress.progress }) });
        send({ type: "result", requestId: request.requestId, result: { backend: session.backend, sessionMs: session.sessionMs } });
      } finally {
        progressRequestId = undefined;
      }
      return;
    }
    if (request.type === "run") {
      if (!session) throw new PPOCRv6Error("SESSION_CREATE_FAILED", "Worker session is not loaded");
      progressRequestId = request.requestId;
      let output: Record<string, unknown>;
      try {
        output = await session.run({ [request.inputName]: new ort.Tensor("float32", new Float32Array(request.input), request.dims) });
      } finally {
        progressRequestId = undefined;
      }
      if (cancelled.delete(request.requestId)) return;
      const result = Object.fromEntries(Object.entries(output).flatMap(([name, value]) => value instanceof ort.Tensor
        ? [[name, { type: value.type, data: value.data.buffer as ArrayBuffer, dims: value.dims }]]
        : []));
      const buffers = Object.values(result).map((value) => value.data);
      send({ type: "result", requestId: request.requestId, result }, buffers);
      return;
    }
    await session?.dispose();
    session = undefined;
    send({ type: "result", requestId: request.requestId, result: { disposed: true } });
  } catch (error) {
    send(errorMessage(request.requestId, error));
  }
};
scope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === "cancel") { cancelled.add(event.data.requestId); return; }
  queue = queue.then(() => handle(event));
});
