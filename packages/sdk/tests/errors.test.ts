import { describe, expect, it } from "vitest";
import { ERROR_CODES, PPOCRv6Error } from "../src/errors";

describe("PPOCRv6Error", () => {
  it("serializes code and details deterministically", () => {
    const error = new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "WebGPU unavailable", { backend: "webgpu", capability: "webgpu" });
    expect(error.toJSON()).toEqual({ name: "PPOCRv6Error", code: "CAPABILITY_UNSUPPORTED", message: "WebGPU unavailable", details: { backend: "webgpu", capability: "webgpu" } });
    expect(JSON.parse(JSON.stringify(error))).toEqual(error.toJSON());
  });

  it("serializes every documented stable error code", () => {
    expect(ERROR_CODES).toEqual(["INVALID_MANIFEST", "CAPABILITY_UNSUPPORTED", "INVALID_INPUT", "MODEL_DOWNLOAD_FAILED", "MODEL_INTEGRITY_FAILED", "OUT_OF_MEMORY", "SESSION_CREATE_FAILED", "INFERENCE_FAILED", "ABORTED", "DISPOSED"]);
    for (const code of ERROR_CODES) {
      expect(new PPOCRv6Error(code).toJSON()).toMatchObject({ code, message: code });
    }
  });

  it("rejects unsafe error details instead of serializing lossy values", () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    for (const details of [
      { invalid: undefined },
      { invalid: 1n },
      { invalid: () => undefined },
      { invalid: Symbol("invalid") },
      { invalid: Number.NaN },
      { invalid: new Date() },
      cycle,
    ]) {
      expect(() => new PPOCRv6Error("INVALID_INPUT", undefined, details as never)).toThrow(TypeError);
    }
  });

  it("copies accepted details so later caller mutation cannot make them unsafe", () => {
    const source = { stage: "load" };
    const error = new PPOCRv6Error("INFERENCE_FAILED", undefined, source);
    (source as { stage: string | undefined }).stage = undefined;
    expect(error.toJSON()).toMatchObject({ details: { stage: "load" } });
    expect(JSON.stringify(error)).toContain('"stage":"load"');
  });
});
