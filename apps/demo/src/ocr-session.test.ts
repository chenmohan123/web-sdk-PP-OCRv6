import { describe, expect, it, vi } from "vitest";
import { createOCRSessionManager } from "./ocr-session";

describe("OCR session manager", () => {
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
