import type { ModelCache, ModelCacheIdentity } from "./model-cache";

export const modelCacheKey = (identity: ModelCacheIdentity): string => [identity.modelId, identity.version, identity.variant, identity.sha256].map((part) => encodeURIComponent(part)).join("/");

export function createMemoryCache(): ModelCache {
  const entries = new Map<string, { identity: ModelCacheIdentity; bytes: Uint8Array }>();
  return {
    async get(identity) { const entry = entries.get(modelCacheKey(identity)); return entry?.bytes.slice(); },
    async set(identity, bytes) { entries.set(modelCacheKey(identity), { identity: { ...identity }, bytes: bytes.slice() }); },
    async list() { return Array.from(entries.values(), (entry) => ({ ...entry.identity })); },
    async estimate() { return { usage: Array.from(entries.values()).reduce((total, entry) => total + entry.bytes.byteLength, 0) }; },
    async clearCurrent(modelId, version) { for (const [key, entry] of entries) if (entry.identity.modelId === modelId && entry.identity.version === version) entries.delete(key); },
    async clearAll() { entries.clear(); },
  };
}
