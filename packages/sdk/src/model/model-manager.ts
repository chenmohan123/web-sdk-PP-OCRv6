import type { ModelCache, ModelCacheIdentity } from "../cache/model-cache";
import { createMemoryCache, modelCacheKey } from "../cache/memory-cache";
import { PPOCRv6Error } from "../errors";
import { downloadModel } from "./download";
import type { HashFunction } from "./integrity";

export interface ModelLoadRequest extends ModelCacheIdentity { readonly bytes: number; readonly url: string; }
export interface ModelLoadResult { readonly bytes: Uint8Array; readonly source: "cache" | "network"; readonly timings: { readonly modelCacheReadMs: number; readonly modelDownloadMs: number; readonly integrityMs: number }; }
export interface ModelManager { readonly cache: ModelCache; load(request: ModelLoadRequest, signal?: AbortSignal): Promise<ModelLoadResult>; }

export function createModelManager(options: { cache?: ModelCache; fetchImpl?: typeof fetch; hash?: HashFunction } = {}): ModelManager {
  const cache = options.cache ?? createMemoryCache();
  return {
    cache,
    async load(request, signal) {
      const cacheStarted = performance.now();
      const cached = await cache.get(request);
      const modelCacheReadMs = performance.now() - cacheStarted;
      if (cached) {
        if (cached.byteLength !== request.bytes) throw new PPOCRv6Error("MODEL_INTEGRITY_FAILED", "Cached model byte length does not match manifest", { expectedBytes: request.bytes, actualBytes: cached.byteLength });
        return { bytes: cached, source: "cache", timings: { modelCacheReadMs, modelDownloadMs: 0, integrityMs: 0 } };
      }
      const downloadOptions = {
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
        ...(options.hash === undefined ? {} : { hash: options.hash }),
        ...(signal === undefined ? {} : { signal }),
      };
      const downloaded = await downloadModel(request, downloadOptions);
      await cache.set(request, downloaded.bytes);
      return { bytes: downloaded.bytes, source: "network", timings: { modelCacheReadMs, modelDownloadMs: downloaded.downloadMs, integrityMs: downloaded.integrityMs } };
    },
  };
}

export { modelCacheKey };
