import type { ModelCache, ModelCacheIdentity } from "./model-cache";
import { createMemoryCache, modelCacheKey } from "./memory-cache";
import { createCacheCoordinator } from "./coordinator";

interface StoredEntry { identity: ModelCacheIdentity; bytes: ArrayBuffer }
const coordinators = new Map<string, ReturnType<typeof createCacheCoordinator>>();

export function createIndexedDBCache(options: { name?: string; store?: string } = {}): ModelCache {
  if (typeof indexedDB === "undefined") return createMemoryCache();
  const dbName = options.name ?? "web-sdk-pp-ocrv6";
  const storeName = options.store ?? "models";
  const scope = JSON.stringify([dbName, storeName]);
  const coordinator = coordinators.get(scope) ?? createCacheCoordinator();
  coordinators.set(scope, coordinator);
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
  // 请求成功后仍可能回滚，只有事务完成才能报告写入或清理成功。
  const transact = <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> => open().then((db) => new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = db.transaction(storeName, mode); }
    catch (error) { db.close(); reject(error); return; }
    let result: T;
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("IndexedDB 事务已中止")); };
    transaction.onerror = () => { /* 由 onabort 报告失败并关闭连接。 */ };
    try { action(transaction.objectStore(storeName), (value) => { result = value; }); }
    catch (error) { transaction.abort(); reject(error); }
  }));
  const write = (identity: ModelCacheIdentity, bytes: Uint8Array) => transact<void>("readwrite", (store) => { store.put({ identity: { ...identity }, bytes: bytes.slice().buffer }, modelCacheKey(identity)); });
  return {
    get(identity) { return coordinator.enqueue(() => transact<Uint8Array | undefined>("readonly", (store, done) => { const request = store.get(modelCacheKey(identity)); request.onsuccess = () => { const value = request.result as StoredEntry | undefined; done(value ? new Uint8Array(value.bytes) : undefined); }; })); },
    set(identity, bytes) { return coordinator.enqueue(() => write(identity, bytes)); },
    createWriter() { const valid = coordinator.capture(); return (identity, bytes) => coordinator.enqueue(async () => { if (valid(identity)) await write(identity, bytes); }); },
    list() { return coordinator.enqueue(() => transact<readonly ModelCacheIdentity[]>("readonly", (store, done) => { const request = store.getAll(); request.onsuccess = () => done((request.result as StoredEntry[]).map((entry) => ({ ...entry.identity }))); })); },
    estimate(modelId, version) { return coordinator.enqueue(() => transact<{ usage: number }>("readonly", (store, done) => {
      let usage = 0;
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { done({ usage }); return; }
        const entry = cursor.value as StoredEntry;
        if (modelId === undefined || (entry.identity.modelId === modelId && (version === undefined || entry.identity.version === version))) usage += entry.bytes.byteLength;
        cursor.continue();
      };
    })); },
    clearCurrent(modelId, version) {
      coordinator.invalidate(modelId, version);
      return coordinator.enqueue(() => transact<void>("readwrite", (store) => {
        const request = store.openCursor();
        request.onsuccess = () => { const cursor = request.result; if (!cursor) return; const entry = cursor.value as StoredEntry; if (entry.identity.modelId === modelId && entry.identity.version === version) cursor.delete(); cursor.continue(); };
      }));
    },
    clearAll() { coordinator.invalidate(); return coordinator.enqueue(() => transact<void>("readwrite", (store) => { store.clear(); })); },
  };
}
