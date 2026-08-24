import { describe, expect, it, vi } from "vitest";
import { createOrtSession } from "../src/runtime/ort-session";

function fakeSession() {
  return { run: vi.fn().mockResolvedValue({ output: { data: new Float32Array([1]) } }), release: vi.fn().mockResolvedValue(undefined), inputNames: ["x"], outputNames: ["output"], inputMetadata: [], outputMetadata: [] };
}

describe("ORT session factory", () => {
  it("creates the requested provider and configures wasm paths", async () => {
    const session = fakeSession();
    const create = vi.fn().mockResolvedValue(session);
    const ort = { InferenceSession: { create }, env: { wasm: {} } } as never;
    const progress = vi.fn();
    const handle = await createOrtSession({ ort, backend: "wasm", model: new Uint8Array([1, 2]).buffer, wasmPaths: "/assets/", numThreads: 2, onProgress: progress });
    expect(create).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.objectContaining({ executionProviders: ["wasm"], intraOpNumThreads: 2 }));
    expect((ort as { env: { wasm: Record<string, unknown> } }).env.wasm.wasmPaths).toBe("/assets/");
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: "session" }));
    await handle.dispose();
    await handle.dispose();
    expect(session.release).toHaveBeenCalledTimes(1);
  });

  it("translates create and run failures to stable errors and honors abort", async () => {
    const create = vi.fn().mockRejectedValue(new Error("out of memory while creating"));
    const ort = { InferenceSession: { create }, env: { wasm: {} } } as never;
    await expect(createOrtSession({ ort, backend: "webgpu", model: new ArrayBuffer(0) })).rejects.toMatchObject({ code: "OUT_OF_MEMORY" });

    const session = fakeSession();
    session.run.mockRejectedValue(new Error("kernel failed"));
    const handle = await createOrtSession({ ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) }, env: { wasm: {} } } as never, backend: "wasm", model: new ArrayBuffer(0) });
    await expect(handle.run({ x: { data: new Float32Array([1]) } } as never)).rejects.toMatchObject({ code: "INFERENCE_FAILED" });
    const controller = new AbortController();
    controller.abort();
    await expect(handle.run({}, controller.signal)).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("rejects promptly when an in-flight run is aborted", async () => {
    let release!: () => void;
    const session = fakeSession();
    session.run.mockImplementation(() => new Promise((resolve) => { release = () => resolve({}); }));
    const handle = await createOrtSession({ ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) }, env: { wasm: {} } } as never, backend: "wasm", model: new ArrayBuffer(0) });
    const controller = new AbortController();
    const running = handle.run({}, controller.signal);
    controller.abort();
    await expect(running).rejects.toMatchObject({ code: "ABORTED" });
    release();
  });

  it("returns DISPOSED when run is called after dispose", async () => {
    const session = fakeSession();
    const handle = await createOrtSession({
      ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) }, env: { wasm: {} } } as never,
      backend: "wasm",
      model: new ArrayBuffer(0),
    });
    await handle.dispose();
    await expect(handle.run({})).rejects.toMatchObject({ code: "DISPOSED" });
    expect(session.run).not.toHaveBeenCalled();
  });
});
