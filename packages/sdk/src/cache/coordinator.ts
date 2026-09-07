import type { ModelCacheIdentity } from "./model-cache";

const scopeKey = (identity: Pick<ModelCacheIdentity, "modelId" | "version">) => JSON.stringify([identity.modelId, identity.version]);

/** 同一存储的清理和写入依调用顺序执行；失败不会阻塞后续操作。 */
export function createCacheCoordinator() {
  let tail = Promise.resolve();
  let globalGeneration = 0;
  const generations = new Map<string, number>();
  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const pending = tail.then(operation);
      tail = pending.then(() => undefined, () => undefined);
      return pending;
    },
    capture() {
      const global = globalGeneration;
      const scopes = new Map(generations);
      return (identity: ModelCacheIdentity) => global === globalGeneration && (scopes.get(scopeKey(identity)) ?? 0) === (generations.get(scopeKey(identity)) ?? 0);
    },
    invalidate(modelId?: string, version?: string) {
      if (modelId === undefined) { globalGeneration += 1; generations.clear(); }
      else {
        const key = scopeKey({ modelId, version: version! });
        generations.set(key, (generations.get(key) ?? 0) + 1);
      }
    },
  };
}
