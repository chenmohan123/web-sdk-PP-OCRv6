import { describe, expect, it } from "vitest";
import { probeCapabilities } from "../src/runtime/capabilities";
import { selectExecutionPlan } from "../src/runtime/select-plan";
import { PPOCRv6Error } from "../src/errors";

describe("runtime capabilities and backend selection", () => {
  it("is safe when browser globals are absent", () => {
    const capabilities = probeCapabilities({
      WebAssembly: undefined,
      Worker: undefined,
      OffscreenCanvas: undefined,
      navigator: undefined,
      SharedArrayBuffer: undefined,
      Atomics: undefined,
      crossOriginIsolated: false,
    });
    expect(capabilities).toMatchObject({ wasm: false, webgpu: false, worker: false, offscreenCanvas: false });
  });

  it("uses wasm as the default requested backend", () => {
    const plan = selectExecutionPlan({}, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: true, offscreenCanvas: true });
    expect(plan).toMatchObject({ requestedBackend: "wasm", candidates: ["wasm"] });
  });

  it("selects an available explicit wasm backend", () => {
    const plan = selectExecutionPlan({ backend: "wasm" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: true, offscreenCanvas: true });
    expect(plan.candidates).toEqual(["wasm"]);
  });

  it("selects an available explicit webgpu backend", () => {
    const plan = selectExecutionPlan({ backend: "webgpu" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: true, offscreenCanvas: true });
    expect(plan.candidates).toEqual(["webgpu"]);
  });

  it("rejects an unavailable explicit backend", () => {
    expect(() => selectExecutionPlan({ backend: "webgpu" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: false, worker: true, offscreenCanvas: true }))
      .toThrowError(PPOCRv6Error);
    try { selectExecutionPlan({ backend: "webgpu" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: false, worker: true, offscreenCanvas: true }); }
    catch (error) { expect((error as PPOCRv6Error).code).toBe("CAPABILITY_UNSUPPORTED"); }
  });

  it("orders auto fallback as webgpu then wasm", () => {
    const plan = selectExecutionPlan({ backend: "auto", allowFallback: true }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: true, offscreenCanvas: true });
    expect(plan.candidates).toEqual(["webgpu", "wasm"]);
  });

  it("does not fall back from an explicit auto backend without permission", () => {
    expect(() => selectExecutionPlan({ backend: "auto" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: false, worker: true, offscreenCanvas: true }))
      .toThrowError(PPOCRv6Error);
  });

  it("uses webgpu for explicit auto when webgpu is available", () => {
    const plan = selectExecutionPlan({ backend: "auto" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: true, offscreenCanvas: true });
    expect(plan.candidates).toEqual(["webgpu"]);
  });

  it("rejects worker execution when Worker is absent", () => {
    expect(() => selectExecutionPlan({ execution: "worker" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: false, offscreenCanvas: false }))
      .toThrowError(PPOCRv6Error);
  });

  it("requires isolated injected thread primitives and a validating shared-memory module", () => {
    const wasm = { validate: () => true } as unknown as typeof WebAssembly;
    expect(probeCapabilities({ WebAssembly: wasm, crossOriginIsolated: false, SharedArrayBuffer: {}, Atomics: {} }).wasmThreads).toBe(false);
    expect(probeCapabilities({ WebAssembly: wasm, crossOriginIsolated: true, SharedArrayBuffer: undefined, Atomics: {} }).wasmThreads).toBe(false);
    expect(probeCapabilities({ WebAssembly: wasm, crossOriginIsolated: true, SharedArrayBuffer: {}, Atomics: undefined }).wasmThreads).toBe(false);
    expect(probeCapabilities({ WebAssembly: { validate: () => false } as unknown as typeof WebAssembly, crossOriginIsolated: true, SharedArrayBuffer: {}, Atomics: {} }).wasmThreads).toBe(false);
    expect(probeCapabilities({ WebAssembly: wasm, crossOriginIsolated: true, SharedArrayBuffer: {}, Atomics: {} }).wasmThreads).toBe(true);
    expect(probeCapabilities({ WebAssembly: { validate: () => { throw new Error("unsupported"); } } as unknown as typeof WebAssembly, crossOriginIsolated: true, SharedArrayBuffer: {}, Atomics: {} }).wasmThreads).toBe(false);
  });
});
