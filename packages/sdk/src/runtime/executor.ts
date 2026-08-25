import * as ort from "onnxruntime-web";
import type { InferenceTensor } from "../detector/detector";
import type { Backend, ExecutionMode } from "../types";
import { createOrtSession } from "./ort-session";
import type { SerializedTensor } from "./protocol";
import { createWorkerBridge } from "./worker-bridge";
import type { OrtSessionProgress } from "./ort-session";

export interface InferenceExecutor {
  readonly sessionMs: number;
  run(inputName: string, data: Float32Array, dims: readonly number[], signal?: AbortSignal): Promise<Record<string, InferenceTensor>>;
  dispose(): Promise<void>;
}

export async function createInferenceExecutor(options: { readonly model: Uint8Array; readonly backend: Exclude<Backend, "auto">; readonly execution: ExecutionMode; readonly workerFactory?: () => Worker; readonly numThreads?: number; readonly onProgress?: (progress: OrtSessionProgress) => void }): Promise<InferenceExecutor> {
  if (options.execution === "worker") {
    const worker = (options.workerFactory ?? (() => new Worker(new URL("./inference.worker.js", import.meta.url), { type: "module", name: "pp-ocrv6-inference" })))();
    const bridge = createWorkerBridge(worker, options.onProgress === undefined ? {} : { onProgress: options.onProgress });
    const loaded = await bridge.load(options.model.slice().buffer, options.backend) as { sessionMs?: number };
    return {
      sessionMs: loaded.sessionMs ?? 0,
      async run(inputName, data, dims, signal) {
        const result = await bridge.run({ inputName, buffer: data.slice().buffer, dims }, signal) as Record<string, SerializedTensor>;
        return Object.fromEntries(Object.entries(result).map(([name, tensor]) => [name, { data: new Float32Array(tensor.data), dims: tensor.dims }]));
      },
      dispose: () => bridge.dispose(),
    };
  }
  const handle = await createOrtSession({ backend: options.backend, model: options.model.slice().buffer, ...(options.numThreads === undefined ? {} : { numThreads: options.numThreads }), ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }) });
  return {
    sessionMs: handle.sessionMs,
    async run(inputName, data, dims, signal) {
      const output = await handle.run({ [inputName]: new ort.Tensor("float32", data, dims) }, signal);
      return Object.fromEntries(Object.entries(output).flatMap(([name, value]) => value instanceof ort.Tensor ? [[name, { data: value.data as Float32Array, dims: value.dims }]] : []));
    },
    dispose: () => handle.dispose(),
  };
}
