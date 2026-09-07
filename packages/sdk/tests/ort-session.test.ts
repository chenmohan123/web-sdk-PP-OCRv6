import { describe, expect, it, vi } from "vitest";
import { createOrtSession, type OrtSessionHandle } from "../src/runtime/ort-session";

function fakeSession() {
  return { run: vi.fn().mockResolvedValue({ output: { data: new Float32Array([1]) } }), release: vi.fn().mockResolvedValue(undefined), inputNames: ["x"], outputNames: ["output"], inputMetadata: [], outputMetadata: [] };
}

describe("ORT session factory", () => {
  it("GPU 会话也使用显式 WASM 资源路径", async () => {
    const ort = { InferenceSession: { create: vi.fn().mockResolvedValue(fakeSession()) }, env: { wasm: {} as Record<string, unknown> } };
    const handle = await createOrtSession({ ort, backend: "webgpu", model: new ArrayBuffer(0), wasmPaths: "https://demo.test/ort/" });
    expect(ort.env.wasm.wasmPaths).toBe("https://demo.test/ort/");
    await handle.dispose();
  });

  it.each([
    [new Error("Aborted(CompileError: WebAssembly.instantiate(): expected magic word)"), "SESSION_CREATE_FAILED"],
    [new Error("Aborted(out of memory)"), "OUT_OF_MEMORY"],
    [new Error("failed to load /cancel/runtime.wasm"), "SESSION_CREATE_FAILED"],
    [new DOMException("操作已取消", "AbortError"), "ABORTED"],
  ])("准确区分运行时故障与用户取消：%s", async (error, code) => {
    const ort = { InferenceSession: { create: vi.fn().mockRejectedValue(error) }, env: { wasm: {} } };
    await expect(createOrtSession({ ort, backend: "wasm", model: new ArrayBuffer(0) })).rejects.toMatchObject({ code });
  });

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

  it("isolates progress callback failures", async () => {
    const session = fakeSession();
    const handle = await createOrtSession({
      ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) }, env: { wasm: {} } } as never,
      backend: "wasm",
      model: new ArrayBuffer(0),
      onProgress: () => { throw new Error("consumer failed"); },
    });
    await expect(handle.run({})).resolves.toEqual({ output: { data: new Float32Array([1]) } });
    await handle.dispose();
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
    await vi.waitFor(() => expect(session.run).toHaveBeenCalledOnce());
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

  it("取消后重跑会等待上一条底层推理结束", async () => {
    let finish!: () => void;
    const session = fakeSession();
    session.run.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({}); }));
    const handle = await createOrtSession({ ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) } }, backend: "wasm", model: new ArrayBuffer(0) });
    const controller = new AbortController();
    const first = handle.run({}, controller.signal);
    await vi.waitFor(() => expect(session.run).toHaveBeenCalledOnce());
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: "ABORTED" });
    const second = handle.run({});
    await Promise.resolve();
    expect(session.run).toHaveBeenCalledOnce();
    finish();
    await second;
    expect(session.run).toHaveBeenCalledTimes(2);
    await handle.dispose();
  });

  it("取消后释放会等待底层推理并保持重复释放幂等", async () => {
    let finish!: () => void;
    const session = fakeSession();
    session.run.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({}); }));
    const handle = await createOrtSession({ ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) } }, backend: "wasm", model: new ArrayBuffer(0) });
    const controller = new AbortController();
    const first = handle.run({}, controller.signal);
    await vi.waitFor(() => expect(session.run).toHaveBeenCalledOnce());
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: "ABORTED" });
    const disposing = handle.dispose();
    const repeated = handle.dispose();
    await Promise.resolve();
    expect(session.release).not.toHaveBeenCalled();
    finish();
    await Promise.all([disposing, repeated]);
    expect(session.release).toHaveBeenCalledOnce();
  });

  it("排队中的任务取消后不启动底层推理", async () => {
    let finish!: () => void;
    const session = fakeSession();
    session.run.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({}); }));
    const handle = await createOrtSession({ ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) } }, backend: "wasm", model: new ArrayBuffer(0) });
    const first = handle.run({});
    await vi.waitFor(() => expect(session.run).toHaveBeenCalledOnce());
    const controller = new AbortController();
    const queued = handle.run({}, controller.signal);
    controller.abort();
    await expect(queued).rejects.toMatchObject({ code: "ABORTED" });
    finish();
    await first;
    await handle.run({});
    expect(session.run).toHaveBeenCalledTimes(2);
    await handle.dispose();
  });

  it("进度回调中取消会阻止底层推理启动", async () => {
    const session = fakeSession();
    const controller = new AbortController();
    const handle = await createOrtSession({
      ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) } }, backend: "wasm", model: new ArrayBuffer(0),
      onProgress: (event) => { if (event.phase === "inference" && event.progress === 0) controller.abort(); },
    });
    await expect(handle.run({}, controller.signal)).rejects.toMatchObject({ code: "ABORTED" });
    expect(session.run).not.toHaveBeenCalled();
    await handle.dispose();
  });

  it("进度回调中释放会阻止底层推理启动", async () => {
    const session = fakeSession();
    let handle!: OrtSessionHandle;
    handle = await createOrtSession({
      ort: { InferenceSession: { create: vi.fn().mockResolvedValue(session) } }, backend: "wasm", model: new ArrayBuffer(0),
      onProgress: (event) => { if (event.phase === "inference" && event.progress === 0) void handle.dispose(); },
    });
    await expect(handle.run({})).rejects.toMatchObject({ code: "DISPOSED" });
    expect(session.run).not.toHaveBeenCalled();
    await handle.dispose();
    expect(session.release).toHaveBeenCalledOnce();
  });
});
