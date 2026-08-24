import { describe, expect, it } from "vitest";
import { createMemoryCache, modelCacheKey } from "../src/cache/memory-cache";

describe("model cache", () => {
  it("names entries by model, version, variant, and sha", async () => {
    expect(modelCacheKey({ modelId: "pp", version: "1", variant: "small", sha256: "a" })).not.toBe(modelCacheKey({ modelId: "pp", version: "2", variant: "small", sha256: "a" }));
    expect(modelCacheKey({ modelId: "pp", version: "1", variant: "small", sha256: "a" })).not.toBe(modelCacheKey({ modelId: "pp", version: "1", variant: "small", sha256: "b" }));
  });

  it("clears current model without removing other versions and clears all globally", async () => {
    const cache = createMemoryCache();
    await cache.set({ modelId: "pp", version: "1", variant: "small", sha256: "a" }, new Uint8Array([1]));
    await cache.set({ modelId: "pp", version: "2", variant: "small", sha256: "b" }, new Uint8Array([2]));
    await cache.clearCurrent("pp", "1");
    expect(await cache.list()).toHaveLength(1);
    await cache.clearAll();
    expect(await cache.list()).toHaveLength(0);
  });
});
