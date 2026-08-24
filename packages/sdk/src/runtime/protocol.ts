import type { Backend } from "../types";
import type { ErrorCode, ErrorDetails } from "../errors";

export type WorkerRequest =
  | { readonly type: "load"; readonly requestId: string; readonly model: ArrayBuffer; readonly backend: Exclude<Backend, "auto"> }
  | { readonly type: "run"; readonly requestId: string; readonly input: ArrayBuffer; readonly inputName: string; readonly dims: readonly number[] }
  | { readonly type: "cancel"; readonly requestId: string }
  | { readonly type: "dispose"; readonly requestId: string };

export type WorkerResponse =
  | { readonly type: "progress"; readonly requestId: string; readonly phase: string; readonly progress?: number }
  | { readonly type: "result"; readonly requestId: string; readonly result: unknown }
  | { readonly type: "error"; readonly requestId: string; readonly code: ErrorCode; readonly message: string; readonly details?: ErrorDetails };

export interface SerializedTensor { readonly type: string; readonly data: ArrayBuffer; readonly dims: readonly number[]; }

export const transferableBuffers = (value: ArrayBuffer | ArrayBufferView): Transferable[] => {
  const buffer = value instanceof ArrayBuffer ? value : value.buffer;
  return [buffer as ArrayBuffer];
};
