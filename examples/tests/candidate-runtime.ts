import { clearAllModelCache, createOCR, getModelCacheUsage, resolveModelCacheIdentity, type ExecutionMode, type ModelManifest } from "web-sdk-pp-ocrv6";

// 由候选消费者脚本复制到独立工程；所有调用均经过已安装 tarball 的公开入口。
export async function verifyCandidate(execution: ExecutionMode, manifest: ModelManifest) {
  await clearAllModelCache();
  const selection = { manifest, preset: "tiny" as const };
  const model = { det: selection, rec: selection };
  const identity = await resolveModelCacheIdentity(selection);
  const options = { model, execution, backend: "wasm" as const, allowFallback: false, wasmPaths: new URL("./ort/", location.href).href };
  const ocr = createOCR(options);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  canvas.getContext("2d")!.fillRect(0, 0, 32, 32);
  await ocr.load();
  const result = await ocr.ocr(canvas);
  const usage = await getModelCacheUsage(identity.modelId, identity.version);
  const abort = new AbortController();
  abort.abort();
  const aborted = await ocr.ocr(canvas, { signal: abort.signal }).then(() => "unexpected", (error: { code: string }) => error.code);
  await ocr.dispose();
  await ocr.dispose();
  const disposed = await ocr.ocr(canvas).then(() => "unexpected", (error: { code: string }) => error.code);
  await clearAllModelCache();
  let stop!: () => Promise<void>;
  let disposal: Promise<void> | undefined;
  const loading = createOCR({ ...options, onProgress(event) { if (event.phase === "download") disposal ??= stop(); } });
  stop = () => loading.dispose();
  const canceledLoad = await loading.load().then(() => "unexpected", (error: { code: string }) => error.code);
  await disposal;
  await loading.dispose();
  return { identity, result, usage, aborted, disposed, canceledLoad, cleared: await getModelCacheUsage() };
}

Object.assign(window, { verifyCandidate });
