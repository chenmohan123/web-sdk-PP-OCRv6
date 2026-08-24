import type { ModelCache, ModelCacheIdentity } from "./model-cache";
import { createMemoryCache, modelCacheKey } from "./memory-cache";

interface StoredEntry { identity: ModelCacheIdentity; bytes: ArrayBuffer }

export function createIndexedDBCache(options: { name?: string; store?: string } = {}): ModelCache {
  if (typeof indexedDB === "undefined") return createMemoryCache();
  const dbName = options.name ?? "web-sdk-pp-ocrv6";
  const storeName = options.store ?? "models";
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
  const transact = <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> => open().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    action(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.oncomplete = () => db.close();
  }));
  return {
    async get(identity) {
      return transact<Uint8Array | undefined>("readonly", (store, done, fail) => { const request = store.get(modelCacheKey(identity)); request.onsuccess = () => { const value = request.result as StoredEntry | undefined; done(value ? new Uint8Array(value.bytes) : undefined); }; request.onerror = () => fail(request.error); });
    },
    async set(identity, bytes) {
      await transact<void>("readwrite", (store, done, fail) => { const request = store.put({ identity: { ...identity }, bytes: bytes.slice().buffer }, modelCacheKey(identity)); request.onsuccess = () => done(undefined); request.onerror = () => fail(request.error); });
    },
    async list() {
      return transact<readonly ModelCacheIdentity[]>("readonly", (store, done, fail) => { const request = store.getAll(); request.onsuccess = () => done((request.result as StoredEntry[]).map((entry) => ({ ...entry.identity }))); request.onerror = () => fail(request.error); });
    },
    async clearCurrent(modelId, version) {
      const identities = await this.list();
      await Promise.all(identities.filter((identity) => identity.modelId === modelId && identity.version === version).map((identity) => transact<void>("readwrite", (store, done, fail) => { const request = store.delete(modelCacheKey(identity)); request.onsuccess = () => done(undefined); request.onerror = () => fail(request.error); })));
    },
    async clearAll() { await transact<void>("readwrite", (store, done, fail) => { const request = store.clear(); request.onsuccess = () => done(undefined); request.onerror = () => fail(request.error); }); },
  };
}
