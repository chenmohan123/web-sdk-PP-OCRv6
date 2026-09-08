import { describe, expect, it } from "vitest";
import { actualBackendLabel } from "./runtime-info";
describe("Demo 实际后端", () => {
  it("混合执行显示两个组件，单组件保留该组件实际值", () => {
    expect(actualBackendLabel({ actualBackend: "webgpu", componentBackends: { det: "webgpu", rec: "wasm" } })).toBe("DET: webgpu / REC: wasm");
    expect(actualBackendLabel({ actualBackend: "wasm" })).toBe("wasm");
    expect(actualBackendLabel({ actualBackend: "wasm", componentBackends: { det: "wasm" } })).toBe("DET: wasm");
  });
});
