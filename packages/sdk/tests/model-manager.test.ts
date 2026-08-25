import { describe, expect, it, vi } from "vitest";
import { createModelManager } from "../src/model/model-manager";
import { createMemoryCache } from "../src/cache/memory-cache";
import type { OCRProgress } from "../src/types";
import type { ProgressSource } from "../src/progress";

describe("model manager", () => {
  it("does not cache bytes when integrity verification fails", async () => {
    const cache = createMemoryCache();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const manager = createModelManager({ cache, fetchImpl });
    await expect(manager.load({ modelId: "pp", version: "1", variant: "small", bytes: 3, sha256: "f".repeat(64), url: "https://cdn.test/model.onnx" })).rejects.toMatchObject({ code: "MODEL_INTEGRITY_FAILED" });
    expect(await cache.list()).toHaveLength(0);
  });

  it("reports cache, network download, and integrity phases", async () => {
    const events: unknown[] = [];
    const sources: unknown[] = [];
    const bytes = new Uint8Array([1, 2, 3]);
    const sha256 = "a".repeat(64);
    const manager = createModelManager({
      cache: createMemoryCache(),
      fetchImpl: vi.fn().mockResolvedValue(new Response(bytes)),
      hash: vi.fn().mockResolvedValue(sha256),
      onProgress: (event: OCRProgress) => events.push(event),
      onSource: (source: ProgressSource) => sources.push(source),
    } as never);
    await manager.load({ modelId: "pp", version: "1", variant: "small", bytes: 3, sha256, url: "https://cdn.test/model.onnx" });
    expect(events).toEqual([
      expect.objectContaining({ phase: "cache", progress: 0 }),
      expect.objectContaining({ phase: "cache", progress: 1 }),
      expect.objectContaining({ phase: "download", progress: 0 }),
      expect.objectContaining({ phase: "download", progress: 1 }),
      expect.objectContaining({ phase: "integrity", progress: 0 }),
      expect.objectContaining({ phase: "integrity", progress: 1 }),
    ]);
    expect(sources).toEqual(["network"]);
  });

  it("reports a verified cache hit without a download event", async () => {
    const cache = createMemoryCache();
    const bytes = new Uint8Array([1, 2, 3]);
    const sha256 = "a".repeat(64);
    const request = { modelId: "pp", version: "1", variant: "small", bytes: 3, sha256, url: "https://cdn.test/model.onnx" };
    await cache.set(request, bytes);
    const events: unknown[] = [];
    const sources: unknown[] = [];
    const manager = createModelManager({ cache, hash: vi.fn().mockResolvedValue(sha256), onProgress: (event: OCRProgress) => events.push(event), onSource: (source: ProgressSource) => sources.push(source) } as never);
    await manager.load(request);
    expect(events).toEqual([
      expect.objectContaining({ phase: "cache", progress: 0 }),
      expect.objectContaining({ phase: "cache", progress: 1 }),
      expect.objectContaining({ phase: "integrity", progress: 0 }),
      expect.objectContaining({ phase: "integrity", progress: 1 }),
    ]);
    expect(sources).toEqual(["cache"]);
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

  it("rejects a corrupted cached entry instead of serving it", async () => {
    const cache = createMemoryCache();
    const expected = { modelId: "pp", version: "1", variant: "small", bytes: 3, sha256: "a".repeat(64), url: "https://cdn.test/model.onnx" };
    await cache.set(expected, new Uint8Array([1, 2, 3]));
    const manager = createModelManager({ cache, hash: vi.fn().mockResolvedValue("b".repeat(64)) });
    await expect(manager.load(expected)).rejects.toMatchObject({ code: "MODEL_INTEGRITY_FAILED" });
  });
});
