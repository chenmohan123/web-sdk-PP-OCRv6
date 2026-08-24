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
    });
    expect(capabilities).toMatchObject({ wasm: false, webgpu: false, worker: false, offscreenCanvas: false });
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

  it("rejects worker execution when Worker is absent", () => {
    expect(() => selectExecutionPlan({ execution: "worker" }, { wasm: true, wasmSimd: true, wasmThreads: false, webgpu: true, worker: false, offscreenCanvas: false }))
      .toThrowError(PPOCRv6Error);
  });
});
