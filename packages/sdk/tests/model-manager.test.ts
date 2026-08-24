import { describe, expect, it, vi } from "vitest";
import { createModelManager } from "../src/model/model-manager";
import { createMemoryCache } from "../src/cache/memory-cache";

describe("model manager", () => {
  it("does not cache bytes when integrity verification fails", async () => {
    const cache = createMemoryCache();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const manager = createModelManager({ cache, fetchImpl });
    await expect(manager.load({ modelId: "pp", version: "1", variant: "small", bytes: 3, sha256: "f".repeat(64), url: "https://cdn.test/model.onnx" })).rejects.toMatchObject({ code: "MODEL_INTEGRITY_FAILED" });
    expect(await cache.list()).toHaveLength(0);
  });

  it("serves a verified second load from cache", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const sha256 = "039058c6f2c0cb492c533b3a5e5c0a0dce3c0f8b1f6d0b9f9d4f6d7f4f6f4a1a";
    const cache = createMemoryCache();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(bytes));
    const manager = createModelManager({ cache, fetchImpl, hash: vi.fn().mockResolvedValue(sha256) });
    const expected = { modelId: "pp", version: "1", variant: "small", bytes: 3, sha256, url: "https://cdn.test/model.onnx" };
    await manager.load(expected);
    await manager.load(expected);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
