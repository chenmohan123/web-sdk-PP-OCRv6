import type { ModelCache, ModelCacheIdentity } from "./model-cache";
import { createCacheCoordinator } from "./coordinator";

export const modelCacheKey = (identity: ModelCacheIdentity): string => [identity.modelId, identity.version, identity.variant, identity.sha256].map((part) => encodeURIComponent(part)).join("/");

export function createMemoryCache(): ModelCache {
  const entries = new Map<string, { identity: ModelCacheIdentity; bytes: Uint8Array }>();
  const coordinator = createCacheCoordinator();
  const write = (identity: ModelCacheIdentity, bytes: Uint8Array) => { entries.set(modelCacheKey(identity), { identity: { ...identity }, bytes: bytes.slice() }); };
  return {
    get(identity) { return coordinator.enqueue(async () => entries.get(modelCacheKey(identity))?.bytes.slice()); },
    set(identity, bytes) { return coordinator.enqueue(async () => write(identity, bytes)); },
    createWriter() { const valid = coordinator.capture(); return (identity, bytes) => coordinator.enqueue(async () => { if (valid(identity)) write(identity, bytes); }); },
    list() { return coordinator.enqueue(async () => Array.from(entries.values(), (entry) => ({ ...entry.identity }))); },
    estimate(modelId, version) { return coordinator.enqueue(async () => ({ usage: Array.from(entries.values()).filter((entry) => modelId === undefined || (entry.identity.modelId === modelId && (version === undefined || entry.identity.version === version))).reduce((total, entry) => total + entry.bytes.byteLength, 0) })); },
    clearCurrent(modelId, version) { coordinator.invalidate(modelId, version); return coordinator.enqueue(async () => { for (const [key, entry] of entries) if (entry.identity.modelId === modelId && entry.identity.version === version) entries.delete(key); }); },
    clearAll() { coordinator.invalidate(); return coordinator.enqueue(async () => { entries.clear(); }); },
  };
}
