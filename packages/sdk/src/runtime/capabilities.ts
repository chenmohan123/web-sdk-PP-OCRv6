import type { Capabilities } from "../types";

export interface CapabilityGlobals {
  readonly WebAssembly?: typeof WebAssembly | undefined;
  readonly Worker?: unknown | undefined;
  readonly OffscreenCanvas?: unknown | undefined;
  readonly navigator?: { readonly gpu?: unknown } | undefined;
  readonly SharedArrayBuffer?: unknown | undefined;
  readonly Atomics?: unknown | undefined;
  readonly crossOriginIsolated?: boolean | undefined;
}

const threadModule = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0,
  5, 4, 1, 3, 1, 1,
]);

const wasmSimdSupported = (wasm: typeof WebAssembly | undefined): boolean => {
  if (!wasm || typeof wasm.validate !== "function") return false;
  try {
    // A tiny module containing a SIMD v128 type. Browsers reject it when SIMD is unavailable.
    return wasm.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123]));
  } catch { return false; }
};

const wasmThreadsSupported = (globals: CapabilityGlobals): boolean => {
  if (
    !globals.WebAssembly
    || globals.crossOriginIsolated !== true
    || typeof globals.SharedArrayBuffer === "undefined"
    || typeof globals.Atomics === "undefined"
  ) return false;
  try {
    return globals.WebAssembly.validate(threadModule);
  } catch { return false; }
};

export const probeCapabilities = (globals: CapabilityGlobals = globalThis as unknown as CapabilityGlobals): Capabilities => {
  const wasm = typeof globals.WebAssembly !== "undefined";
  const wasmSimd = wasmSimdSupported(globals.WebAssembly);
  const wasmThreads = wasmThreadsSupported(globals);
  return {
    wasm,
    wasmSimd,
    wasmThreads,
    webgpu: Boolean(globals.navigator?.gpu),
    worker: typeof globals.Worker !== "undefined",
    offscreenCanvas: typeof globals.OffscreenCanvas !== "undefined",
  };
};
