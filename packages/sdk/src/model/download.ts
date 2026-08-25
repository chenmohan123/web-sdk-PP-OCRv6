import { PPOCRv6Error } from "../errors";
import { safeEmitProgress, type ProgressCallback } from "../progress";
import { verifyModelIntegrity, type HashFunction } from "./integrity";

export interface ModelDownloadRequest { readonly url: string; readonly bytes: number; readonly sha256: string; }
export interface ModelDownloadResult { readonly bytes: Uint8Array; readonly downloadMs: number; readonly integrityMs: number; }

export async function downloadModel(request: ModelDownloadRequest, options: { fetchImpl?: typeof fetch; hash?: HashFunction; signal?: AbortSignal; onProgress?: ProgressCallback } = {}): Promise<ModelDownloadResult> {
  const started = performance.now();
  let response: Response;
  try {
    const init: RequestInit = options.signal === undefined ? {} : { signal: options.signal };
    response = await (options.fetchImpl ?? fetch)(request.url, init);
  }
  catch (error) {
    if (options.signal?.aborted) throw new PPOCRv6Error("ABORTED", "Model download aborted");
    throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", error instanceof Error ? error.message : String(error));
  }
  if (!response.ok) throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", `Model download failed with HTTP ${response.status}`, { status: response.status });
  let bytes: Uint8Array;
  try {
    const reader = response.body?.getReader?.();
    if (reader === undefined) {
      safeEmitProgress(options.onProgress, { phase: "download" });
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;
      safeEmitProgress(options.onProgress, { phase: "download", progress: 0, loadedBytes: 0, totalBytes: request.bytes });
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (chunk.value !== undefined) {
          chunks.push(chunk.value);
          loadedBytes += chunk.value.byteLength;
          safeEmitProgress(options.onProgress, { phase: "download", progress: Math.min(loadedBytes / request.bytes, 1), loadedBytes, totalBytes: request.bytes });
        }
      }
      bytes = new Uint8Array(loadedBytes);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    }
  }
  catch (error) { throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", error instanceof Error ? error.message : String(error)); }
  const downloadMs = performance.now() - started;
  const integrityStarted = performance.now();
  safeEmitProgress(options.onProgress, { phase: "integrity", progress: 0 });
  try { await verifyModelIntegrity(bytes, request.bytes, request.sha256, options.hash); }
  catch (error) { throw error; }
  safeEmitProgress(options.onProgress, { phase: "integrity", progress: 1 });
  return { bytes, downloadMs, integrityMs: performance.now() - integrityStarted };
}
