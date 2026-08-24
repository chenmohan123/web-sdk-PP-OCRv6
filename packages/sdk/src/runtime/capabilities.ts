import type { Capabilities } from "../types";

export interface CapabilityGlobals {
  readonly WebAssembly?: typeof WebAssembly | undefined;
  readonly Worker?: unknown | undefined;
  readonly OffscreenCanvas?: unknown | undefined;
  readonly navigator?: { readonly gpu?: unknown } | undefined;
}

const wasmSimdSupported = (wasm: typeof WebAssembly | undefined): boolean => {
  if (!wasm || typeof wasm.validate !== "function") return false;
  try {
    // A tiny module containing a SIMD v128 type. Browsers reject it when SIMD is unavailable.
    return wasm.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123]));
  } catch { return false; }
};

export const probeCapabilities = (globals: CapabilityGlobals = globalThis as unknown as CapabilityGlobals): Capabilities => {
  const wasm = typeof globals.WebAssembly !== "undefined";
  const wasmSimd = wasmSimdSupported(globals.WebAssembly);
  return {
    wasm,
    wasmSimd,
    wasmThreads: wasm && typeof SharedArrayBuffer !== "undefined",
    webgpu: Boolean(globals.navigator?.gpu),
    worker: typeof globals.Worker !== "undefined",
    offscreenCanvas: typeof globals.OffscreenCanvas !== "undefined",
  };
};
