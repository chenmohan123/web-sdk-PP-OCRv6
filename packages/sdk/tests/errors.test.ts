import { describe, expect, it } from "vitest";
import { PPOCRv6Error } from "../src/errors";

describe("PPOCRv6Error", () => {
  it("serializes code and details deterministically", () => {
    const error = new PPOCRv6Error("CAPABILITY_UNSUPPORTED", "WebGPU unavailable", { backend: "webgpu", capability: "webgpu" });
    expect(error.toJSON()).toEqual({ name: "PPOCRv6Error", code: "CAPABILITY_UNSUPPORTED", message: "WebGPU unavailable", details: { backend: "webgpu", capability: "webgpu" } });
    expect(JSON.parse(JSON.stringify(error))).toEqual(error.toJSON());
  });
});
