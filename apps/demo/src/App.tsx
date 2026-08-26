import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Github, ImagePlus, Languages, Play, RotateCcw, Square, Trash2, Upload, Zap } from "lucide-react";
import { clearAllModelCache, clearModelCache, createOCR, type Backend, type ExecutionMode, type OCRResult, type RuntimeOptions } from "web-sdk-pp-ocrv6";
import { en } from "./i18n/en";
import { zhCN } from "./i18n/zh-CN";
import { ImageViewport } from "./ImageViewport";
import { createOCRSessionManager } from "./ocr-session";

type Status = "idle" | "downloading" | "loading" | "running" | "success" | "error" | "unsupported";
type Mode = "ocr" | "detection" | "recognition";
type Preset = "medium" | "small" | "tiny";
const fixtureMode = new URLSearchParams(location.search).has("fixture");
const fixtureErrorMode = new URLSearchParams(location.search).has("fixture-error");
const modelStats = {
  det: { medium: [62032837, 15486640], small: [9880512, 2453368], tiny: [1780590, 428420] },
  rec: { medium: [76554979, 19115263], small: [21159378, 5267732], tiny: [4462639, 1104524] },
} as const;
const fmtMs = (value: number | undefined) => value === undefined ? "-" : `${value.toFixed(1)} ms`;
const fmtBytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;
const fixtureResult = (): OCRResult => ({
  lines: [
    { index: 0, text: "PP-OCRv6 browser OCR", score: 0.96, recognitionScore: 0.98, polygon: [{ x: 70, y: 70 }, { x: 610, y: 70 }, { x: 610, y: 170 }, { x: 70, y: 170 }] },
    { index: 1, text: "where the black hole mass function is measured", score: 0.93, recognitionScore: 0.95, polygon: [{ x: 65, y: 285 }, { x: 390, y: 285 }, { x: 390, y: 340 }, { x: 65, y: 340 }] },
    { index: 2, text: "The present-day SMBH mass function", score: 0.91, recognitionScore: 0.94, polygon: [{ x: 422, y: 450 }, { x: 760, y: 450 }, { x: 760, y: 510 }, { x: 422, y: 510 }] },
    { index: 3, text: "Results stay on this device", score: 0.9, recognitionScore: 0.96, polygon: [{ x: 70, y: 880 }, { x: 400, y: 880 }, { x: 400, y: 950 }, { x: 70, y: 950 }] },
  ],
  detections: [], image: { width: 820, height: 1024, source: "image" }, model: { id: "pp-ocrv6", version: "1.0.0", preset: "small" },
  runtime: { requestedBackend: "wasm", actualBackend: "wasm", execution: "worker", runtimeVersion: "onnxruntime-web@1.27.0" },
  timings: { modelDownloadMs: 182.4, modelCacheReadMs: 0, integrityMs: 14.8, sessionMs: 127.6, decodeMs: 8.2, preprocessMs: 18.6, inferenceMs: 74.3, postprocessMs: 21.1, totalMs: 132.9 },
  stageTimings: { detectionMs: 62.4, cropMs: 7.8, recognitionMs: 62.7 },
});

export function App() {
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const copy = language === "zh" ? zhCN : en;
  const [mode, setMode] = useState<Mode>("ocr");
  const [detPreset, setDetPreset] = useState<Preset>("small");
  const [recPreset, setRecPreset] = useState<Preset>("small");
  const [backend, setBackend] = useState<Backend>("auto");
  const [execution, setExecution] = useState<ExecutionMode>("worker");
  const [allowFallback, setAllowFallback] = useState(true);
  const [manifestUrl, setManifestUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<{ code: string; message: string }>();
  const [source, setSource] = useState<Blob>();
  const [imageUrl, setImageUrl] = useState<string>();
  const [result, setResult] = useState<OCRResult>();
  const [selected, setSelected] = useState<number>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const sessionManagerRef = useRef(createOCRSessionManager(createOCR));
  const detStats = modelStats.det[detPreset];
  const recStats = modelStats.rec[recPreset];

  useEffect(() => () => { if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => () => { void sessionManagerRef.current.dispose(); }, []);
  const timingRows = useMemo(() => [
    [copy.total, result?.timings.totalMs], [copy.modelDownload, result?.timings.modelDownloadMs], [copy.modelLoad, result?.timings.sessionMs],
    [copy.preprocess, result?.timings.preprocessMs], [copy.inference, result?.timings.inferenceMs], [copy.postprocess, result?.timings.postprocessMs],
  ] as const, [copy, result]);

  const setImage = (blob: Blob, url?: string) => {
    if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    setSource(blob); setImageUrl(url ?? URL.createObjectURL(blob)); setResult(undefined); setSelected(undefined); setStatus("idle"); setDownloadProgress(undefined); setError(undefined);
  };
  const useSample = async () => { const response = await fetch("./samples/ocr-fixture.png"); setImage(await response.blob(), "./samples/ocr-fixture.png"); };
  const run = async () => {
    if (!source) return;
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller; setError(undefined); setNotice(""); setDownloadProgress(undefined); setStatus("loading");
    try {
      if (fixtureMode) { setStatus("downloading"); setDownloadProgress(0.25); await new Promise((resolve) => setTimeout(resolve, 150)); setStatus("loading"); await new Promise((resolve) => setTimeout(resolve, 150)); if (fixtureErrorMode) throw { code: "MODEL_DOWNLOAD_FAILED", message: "Failed to fetch" }; setStatus("running"); await new Promise((resolve) => setTimeout(resolve, 150)); const fixture = fixtureResult(); const next: OCRResult = { ...fixture, runtime: { ...fixture.runtime, requestedBackend: backend, actualBackend: backend === "auto" ? "webgpu" : backend, execution } }; setResult(next); setSelected(0); setStatus("success"); return; }
      const custom = manifestUrl.trim() ? { manifestUrl: manifestUrl.trim() } : undefined;
      const options: RuntimeOptions = { backend, execution, allowFallback, model: { det: custom ?? detPreset, rec: custom ?? recPreset }, signal: controller.signal, onProgress: (event) => {
        if (event.phase === "download") { setStatus("downloading"); setDownloadProgress(event.progress); }
        else if (event.phase === "inference") setStatus("running");
        else setStatus("loading");
      } };
      const configKey = JSON.stringify({ manifest: manifestUrl.trim(), det: detPreset, rec: recPreset, backend, execution, allowFallback });
      const { ocr } = await sessionManagerRef.current.ensure(configKey, options); setStatus("running"); const next = await ocr.ocr(source, { signal: controller.signal }); setResult(next); setSelected(next.lines[0]?.index); setStatus("success");
    } catch (caught) {
      if (controller.signal.aborted) { setStatus("idle"); setDownloadProgress(undefined); return; }
      const value = caught as { code?: string; message?: string }; setError({ code: value.code ?? "INFERENCE_FAILED", message: value.message ?? String(caught) }); setStatus(value.code === "CAPABILITY_UNSUPPORTED" ? "unsupported" : "error");
    }
  };
  const reset = () => { abortRef.current?.abort(); setSource(undefined); if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl); setImageUrl(undefined); setResult(undefined); setSelected(undefined); setStatus("idle"); setDownloadProgress(undefined); setError(undefined); };
  const clearCache = async (all: boolean) => { await (all ? clearAllModelCache() : clearModelCache()); setNotice(copy.cacheDone ?? ""); };
  const statusText = status === "downloading" ? copy.downloading : status === "loading" ? copy.loading : status === "running" ? copy.running : status === "success" ? copy.success : status === "error" ? copy.error : status === "unsupported" ? copy.unsupported : copy.ready;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="mark">OCR</div><div><h1>PP-OCRv6</h1><p>Web SDK <span>v0.1.8</span></p></div></div><div className="header-actions"><span className="privacy">{copy.local}</span><a href="https://github.com/chenmohan123/web-sdk-PP-OCRv6" target="_blank" rel="noreferrer"><Github size={16}/>{copy.github}</a><button onClick={() => setLanguage(language === "zh" ? "en" : "zh")}><Languages size={16}/>{copy.language}</button></div></header>
    <section className="workspace">
      <aside className="controls panel" data-testid="controls-panel"><div className="panel-title"><Cpu size={17}/><h2>{copy.controls}</h2></div>
        <fieldset><legend>{copy.mode}</legend><div className="segmented three">{(["ocr", "detection", "recognition"] as const).map((value) => <button key={value} className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => setMode(value)}>{copy[value]}</button>)}</div></fieldset>
        <label>{copy.detModel}<select value={detPreset} onChange={(event) => setDetPreset(event.target.value as Preset)}><option value="medium">Medium</option><option value="small">Small</option><option value="tiny">Tiny</option></select></label>
        <label>{copy.recModel}<select value={recPreset} onChange={(event) => setRecPreset(event.target.value as Preset)}><option value="medium">Medium</option><option value="small">Small</option><option value="tiny">Tiny</option></select></label>
        <fieldset><legend>{copy.backend}</legend><div className="segmented">{(["auto", "wasm", "webgpu"] as const).map((value) => <button key={value} className={backend === value ? "active" : ""} aria-pressed={backend === value} onClick={() => setBackend(value)}>{value === "wasm" ? copy.cpu : value === "webgpu" ? copy.gpu : copy.automatic}</button>)}</div></fieldset>
        <fieldset><legend>{copy.execution}</legend><div className="segmented two">{(["worker", "main"] as const).map((value) => <button key={value} className={execution === value ? "active" : ""} aria-pressed={execution === value} onClick={() => setExecution(value)}>{copy[value]}</button>)}</div></fieldset>
        <label className="check"><input type="checkbox" checked={allowFallback} onChange={(event) => setAllowFallback(event.target.checked)}/><span>{copy.fallback}</span></label>
        <label>{copy.custom}<input type="url" value={manifestUrl} placeholder="https://cdn.example/manifest.json" onChange={(event) => setManifestUrl(event.target.value)}/></label>
        <div className="file-actions"><label className="button secondary"><Upload size={16}/>{source ? copy.replace : copy.choose}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImage(file); }}/></label><button className="secondary" onClick={() => void useSample()}><ImagePlus size={16}/>{copy.sample}</button></div>
        <div className="run-actions"><button className="primary" disabled={!source || status === "loading" || status === "downloading" || status === "running"} onClick={() => void run()}><Play size={17}/>{copy.start}</button><button className="icon-button" title={copy.abort} onClick={() => abortRef.current?.abort()}><Square size={16}/></button><button className="icon-button" title={copy.reset} onClick={reset}><RotateCcw size={17}/></button></div>
        <div className={`run-status ${status}`} data-testid="status" aria-live="polite"><div className="run-status-line"><span className={`status-dot ${status}`}/><strong>{statusText}</strong>{status === "downloading" && downloadProgress !== undefined && <span className="download-percent">{Math.round(downloadProgress * 100)}%</span>}</div>{status === "downloading" && downloadProgress !== undefined && <div className="download-track" data-testid="download-progress" role="progressbar" aria-label={copy.downloading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(downloadProgress * 100)}><span style={{ width: `${Math.round(downloadProgress * 100)}%` }}/></div>}{error && <span className="error-text">{copy.errorCode}: {error.code} · {error.message}</span>}</div>
      </aside>
      <section className="image-panel panel" data-testid="image-panel"><div className="panel-title"><ImagePlus size={17}/><h2>{copy.preview}</h2>{result && <span className="count">{result.lines.length}</span>}</div><div className="canvas-stage"><ImageViewport imageUrl={imageUrl} imageAlt={copy.imageAlt} emptyText={copy.empty} lines={result?.lines ?? []} selected={selected} onSelect={setSelected} copy={copy}/></div><p className="mobile-hint">{copy.mobileHint}</p></section>
      <aside className="details panel" data-testid="details-panel">
        <div className="details-summary">
          <section data-sdk-model-info><div className="panel-title"><Zap size={17}/><h2>{copy.modelInfo}</h2></div><dl><div><dt>{copy.model} DET</dt><dd>PP-OCRv6 {detPreset}</dd></div><div><dt>{copy.size}</dt><dd>{fmtBytes(detStats[0])}</dd></div><div><dt>{copy.parameters}</dt><dd>{detStats[1].toLocaleString()}</dd></div><div><dt>{copy.model} REC</dt><dd>PP-OCRv6 {recPreset}</dd></div><div><dt>{copy.size}</dt><dd>{fmtBytes(recStats[0])}</dd></div><div><dt>{copy.parameters}</dt><dd>{recStats[1].toLocaleString()}</dd></div></dl></section>
          <section data-sdk-runtime-info><h2>{copy.runtimeInfo}</h2><dl><div><dt>{copy.requested}</dt><dd>{backend}</dd></div><div><dt>{copy.actual}</dt><dd>{result?.runtime.actualBackend ?? "-"}</dd></div><div><dt>{copy.execution}</dt><dd>{execution}</dd></div><div><dt>{copy.runtime}</dt><dd>{result?.runtime.runtimeVersion ?? "onnxruntime-web@1.27.0"}</dd></div></dl></section>
          <section data-sdk-timing><h2>{copy.timing}</h2><dl>{timingRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{fmtMs(value)}</dd></div>)}<div className="timing-secondary"><dt>{copy.cacheRead}</dt><dd>{fmtMs(result?.timings.modelCacheReadMs)}</dd></div><div className="timing-secondary"><dt>{copy.integrity}</dt><dd>{fmtMs(result?.timings.integrityMs)}</dd></div><div><dt>CPU {copy.cold}</dt><dd>{result?.runtime.actualBackend === "wasm" ? fmtMs(result.timings.modelDownloadMs + result.timings.sessionMs) : "-"}</dd></div><div><dt>GPU {copy.cold}</dt><dd>{result?.runtime.actualBackend === "webgpu" ? fmtMs(result.timings.modelDownloadMs + result.timings.sessionMs) : "-"}</dd></div></dl></section>
          <section className="cache-actions"><button data-sdk-cache-clear onClick={() => void clearCache(false)}><Trash2 size={15}/>{copy.cacheCurrent}</button><button data-sdk-cache-clear onClick={() => void clearCache(true)}><Trash2 size={15}/>{copy.cacheAll}</button>{notice && <span className="cache-notice" aria-live="polite">{notice}</span>}</section>
        </div>
        <section className="ocr-results" data-testid="ocr-results"><div className="result-heading"><h2>{copy.results}</h2><span>{result?.lines.length ?? 0}</span></div>{result?.lines.length ? result.lines.map((line, order) => <button key={line.index} data-testid={`ocr-row-${line.index}`} aria-current={selected === line.index ? "true" : undefined} className={selected === line.index ? "ocr-row selected" : "ocr-row"} onClick={() => setSelected(line.index)}><span className="row-index">{String(order + 1).padStart(2, "0")}</span><span><strong>{line.text}</strong><small>{copy.score} {(line.recognitionScore * 100).toFixed(1)}%</small></span></button>) : <p className="no-results">{copy.noResults}</p>}</section>
      </aside>
    </section>
  </main>;
}
