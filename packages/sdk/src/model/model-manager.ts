import type { ModelCache, ModelCacheIdentity } from "../cache/model-cache";
import { createMemoryCache, modelCacheKey } from "../cache/memory-cache";
import { PPOCRv6Error } from "../errors";
import { downloadModel } from "./download";
import { verifyModelIntegrity, type HashFunction } from "./integrity";
import { safeEmitProgress, type ProgressCallback, type ProgressSource } from "../progress";

export interface ModelLoadRequest extends ModelCacheIdentity { readonly bytes: number; readonly url: string; }
export interface ModelLoadResult { readonly bytes: Uint8Array; readonly source: "cache" | "network"; readonly timings: { readonly modelCacheReadMs: number; readonly modelDownloadMs: number; readonly integrityMs: number }; }
export interface ModelManager { readonly cache: ModelCache; load(request: ModelLoadRequest, signal?: AbortSignal): Promise<ModelLoadResult>; }

export function createModelManager(options: { cache?: ModelCache; fetchImpl?: typeof fetch; hash?: HashFunction; onProgress?: ProgressCallback; onSource?: (source: ProgressSource) => void } = {}): ModelManager {
  const cache = options.cache ?? createMemoryCache();
  return {
    cache,
    async load(request, signal) {
      const cacheStarted = performance.now();
      safeEmitProgress(options.onProgress, { phase: "cache", progress: 0 });
      const cached = await cache.get(request);
      const modelCacheReadMs = performance.now() - cacheStarted;
      safeEmitProgress(options.onProgress, { phase: "cache", progress: 1 });
      if (cached) {
        options.onSource?.("cache");
        const integrityStarted = performance.now();
        safeEmitProgress(options.onProgress, { phase: "integrity", progress: 0 });
        await verifyModelIntegrity(cached, request.bytes, request.sha256, options.hash);
        safeEmitProgress(options.onProgress, { phase: "integrity", progress: 1 });
        return { bytes: cached, source: "cache", timings: { modelCacheReadMs, modelDownloadMs: 0, integrityMs: performance.now() - integrityStarted } };
      }
      options.onSource?.("network");
      const downloadOptions = {
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
        ...(options.hash === undefined ? {} : { hash: options.hash }),
        ...(signal === undefined ? {} : { signal }),
        ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
      };
      const downloaded = await downloadModel(request, downloadOptions);
      await cache.set(request, downloaded.bytes);
      return { bytes: downloaded.bytes, source: "network", timings: { modelCacheReadMs, modelDownloadMs: downloaded.downloadMs, integrityMs: downloaded.integrityMs } };
    },
  };
}

export { modelCacheKey };
