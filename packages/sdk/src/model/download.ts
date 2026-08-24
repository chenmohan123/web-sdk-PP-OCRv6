import { PPOCRv6Error } from "../errors";
import { verifyModelIntegrity, type HashFunction } from "./integrity";

export interface ModelDownloadRequest { readonly url: string; readonly bytes: number; readonly sha256: string; }
export interface ModelDownloadResult { readonly bytes: Uint8Array; readonly downloadMs: number; readonly integrityMs: number; }

export async function downloadModel(request: ModelDownloadRequest, options: { fetchImpl?: typeof fetch; hash?: HashFunction; signal?: AbortSignal } = {}): Promise<ModelDownloadResult> {
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
  try { bytes = new Uint8Array(await response.arrayBuffer()); }
  catch (error) { throw new PPOCRv6Error("MODEL_DOWNLOAD_FAILED", error instanceof Error ? error.message : String(error)); }
  const downloadMs = performance.now() - started;
  const integrityStarted = performance.now();
  await verifyModelIntegrity(bytes, request.bytes, request.sha256, options.hash);
  return { bytes, downloadMs, integrityMs: performance.now() - integrityStarted };
}
