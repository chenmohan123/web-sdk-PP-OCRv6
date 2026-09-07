import { describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { createMemoryCache } from "../src/cache/memory-cache";
import { createIndexedDBCache } from "../src/cache/indexeddb-cache";
import { createModelManager } from "../src/model/model-manager";

const identity = { modelId: "自定义模型", version: "2", variant: "det", sha256: "a".repeat(64) };
const request = { ...identity, bytes: 3, url: "https://models.test/model.onnx" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { resolve, promise }; }

describe.each(["memory", "indexeddb"])("%s 缓存清理", (kind) => {
  const create = () => kind === "memory" ? createMemoryCache() : createIndexedDBCache({ name: crypto.randomUUID() });
  it.each([false, true])("清理前下载不得迟到写回，all=%s", async (all) => {
    const cache = create();
    const started = deferred<void>(); const response = deferred<Response>();
    const manager = createModelManager({ cache, fetchImpl: async () => { started.resolve(); return response.promise; }, hash: async () => identity.sha256 });
    const loading = manager.load(request);
    await started.promise;
    await (all ? cache.clearAll() : cache.clearCurrent(identity.modelId, identity.version));
    response.resolve(new Response(new Uint8Array([1, 2, 3])));
    await loading;
    expect(await cache.list()).toEqual([]);
  });
  it("清理后新写入不能被旧下载覆盖，也不能误清其他版本", async () => {
    const cache = create();
    const started = deferred<void>(); const response = deferred<Response>();
    const loading = createModelManager({ cache, fetchImpl: async () => { started.resolve(); return response.promise; }, hash: async () => identity.sha256 }).load(request);
    await started.promise;
    const other = { ...identity, version: "3" };
    await cache.set(other, new Uint8Array([4, 5]));
    const clearing = cache.clearCurrent(identity.modelId, identity.version);
    const writing = cache.set(identity, new Uint8Array([7, 8, 9]));
    await Promise.all([clearing, writing]);
    response.resolve(new Response(new Uint8Array([1, 2, 3])));
    await loading;
    expect(await cache.get(identity)).toEqual(new Uint8Array([7, 8, 9]));
    expect(await cache.get(other)).toEqual(new Uint8Array([4, 5]));
  });
  it("统计实际缓存字节并区分当前模型和全部 SDK", async () => {
    const cache = create();
    await cache.set(identity, new Uint8Array(3));
    await cache.set({ ...identity, version: "3" }, new Uint8Array(5));
    expect(await cache.estimate?.()).toMatchObject({ usage: 8 });
    expect(await cache.estimate?.(identity.modelId, identity.version)).toMatchObject({ usage: 3 });
    await cache.clearCurrent(identity.modelId, identity.version);
    expect(await cache.estimate?.()).toMatchObject({ usage: 5 });
  });
});

it("同名 IndexedDB 实例共享失效代次，但其他模型的下载继续缓存", async () => {
  const name = crypto.randomUUID();
  const first = createIndexedDBCache({ name });
  const second = createIndexedDBCache({ name });
  const stale = first.createWriter!();
  await second.clearCurrent(identity.modelId, identity.version);
  await stale(identity, new Uint8Array(3));
  await stale({ ...identity, modelId: "其他模型" }, new Uint8Array(5));
  expect(await first.estimate?.()).toMatchObject({ usage: 5 });
  await second.set(identity, new Uint8Array([8]));
  await stale(identity, new Uint8Array([1]));
  expect(await first.get(identity)).toEqual(new Uint8Array([8]));
});

it("IndexedDB 请求成功但事务回滚时拒绝写入，之后仍可恢复", async () => {
  const cache = createIndexedDBCache({ name: crypto.randomUUID() });
  const original = IDBObjectStore.prototype.put;
  const hook = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const request = original.call(this, value, key);
    request.addEventListener("success", () => this.transaction.abort());
    return request;
  });
  try { await expect(cache.set(identity, new Uint8Array(3))).rejects.toThrow(); }
  finally { hook.mockRestore(); }
  expect(await cache.get(identity)).toBeUndefined();
  await cache.set(identity, new Uint8Array([9]));
  expect(await cache.get(identity)).toEqual(new Uint8Array([9]));
});
