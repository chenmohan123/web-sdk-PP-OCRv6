import { PPOCRv6Error } from "../errors";
import type { Backend, Capabilities, ExecutionMode, RuntimeOptions } from "../types";

export interface ExecutionPlan {
  readonly requestedBackend: Backend;
  readonly execution: ExecutionMode;
  readonly candidates: readonly Exclude<Backend, "auto">[];
}

export const selectExecutionPlan = (options: Pick<RuntimeOptions, "backend" | "execution" | "allowFallback"> = {}, capabilities: Capabilities): ExecutionPlan => {
  const requestedBackend = options.backend ?? "wasm";
  const execution = options.execution ?? "worker";
  if (execution === "worker" && !capabilities.worker) {
    throw new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "Worker execution is unavailable", { capability: "worker", execution });
  }

  const wasmAvailable = capabilities.wasm;
  const webgpuAvailable = capabilities.webgpu;
  let candidates: Exclude<Backend, "auto">[];
  if (requestedBackend === "wasm") {
    if (!wasmAvailable) throw new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "WASM backend is unavailable", { capability: "wasm", backend: requestedBackend });
    candidates = ["wasm"];
  } else if (requestedBackend === "webgpu") {
    if (!webgpuAvailable) throw new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "WebGPU backend is unavailable", { capability: "webgpu", backend: requestedBackend });
    candidates = ["webgpu"];
  } else if (options.allowFallback) {
    candidates = [ ...(webgpuAvailable ? ["webgpu" as const] : []), ...(wasmAvailable ? ["wasm" as const] : []) ];
    if (!candidates.length) throw new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "No supported backend is available", { capability: "wasm|webgpu", backend: requestedBackend });
  } else if (webgpuAvailable) {
    candidates = ["webgpu"];
  } else {
    throw new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "Auto backend selection requires allowFallback", { backend: requestedBackend, allowFallback: false });
  }
  return { requestedBackend, execution, candidates };
};
