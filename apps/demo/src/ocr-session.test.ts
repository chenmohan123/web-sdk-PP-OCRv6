import { describe, expect, it, vi } from "vitest";
import { createOCRSessionManager } from "./ocr-session";

describe("OCR session manager", () => {
  it("旧会话释放失败后不会复用失效实例", async () => {
    const first = { load: async () => {}, dispose: async () => { throw new Error("释放失败"); } };
    const second = { load: async () => {}, dispose: async () => {} };
    let count = 0;
    const manager = createOCRSessionManager((() => ++count === 1 ? first : second) as never);
    await manager.ensure("first", {});
    await expect(manager.ensure("second", {})).rejects.toThrow("释放失败");
    expect((await manager.ensure("first", {})).ocr).toBe(second);
  });
  it("初始化期间释放会等待并回收迟到会话，且允许重新初始化", async () => {
    let finish!: () => void;
    let loaded = false; let disposed = 0;
    const loading = new Promise<void>((resolve) => { finish = resolve; });
    const session = { load: async () => { await loading; loaded = true; }, dispose: async () => { disposed += 1; } };
    const manager = createOCRSessionManager((() => session) as never);
    const pending = manager.ensure("first", {}).catch((error: unknown) => error);
    const disposing = manager.dispose();
    finish();
    await disposing;
    await pending;
    expect(loaded).toBe(true);
    expect(disposed).toBe(1);
    expect((await manager.ensure("first", {})).reused).toBe(false);
  });
  it("reuses a loaded session for the same configuration key", async () => {
    const first = { load: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) };
    const factory = vi.fn().mockReturnValue(first);
    const manager = createOCRSessionManager(factory as never);

    const firstResult = await manager.ensure("auto|small|small", { backend: "auto" });
    const secondResult = await manager.ensure("auto|small|small", { backend: "auto" });

    expect(firstResult.reused).toBe(false);
    expect(secondResult).toMatchObject({ ocr: first, reused: true });
    expect(factory).toHaveBeenCalledOnce();
    expect(first.load).toHaveBeenCalledOnce();
  });

  it("disposes the old session when the configuration key changes", async () => {
    const first = { load: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) };
    const second = { load: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) };
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const manager = createOCRSessionManager(factory as never);

    await manager.ensure("auto|small|small", { backend: "auto" });
    const result = await manager.ensure("wasm|small|small", { backend: "wasm" });

    expect(result).toMatchObject({ ocr: second, reused: false });
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.load).toHaveBeenCalledOnce();
  });

  it("disposes the current session explicitly", async () => {
    const session = { load: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) };
    const manager = createOCRSessionManager(vi.fn().mockReturnValue(session) as never);

    await manager.ensure("auto|small|small", { backend: "auto" });
    await manager.dispose();
    await manager.dispose();

    expect(session.dispose).toHaveBeenCalledOnce();
  });
});
