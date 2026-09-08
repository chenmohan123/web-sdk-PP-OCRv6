# web-sdk-PP-OCRv6

[中文（默认）](README.md) · [GitHub](https://github.com/chenmohan123/web-sdk-PP-OCRv6) · [npm](https://www.npmjs.com/package/web-sdk-pp-ocrv6) · [Live Demo](https://chenmohan123.github.io/web-sdk-PP-OCRv6/)

A framework-neutral browser SDK for PP-OCRv6 text detection, recognition, and the complete `det -> crop -> rec` OCR pipeline through ONNX Runtime Web. It targets desktop/mobile browsers, WeChat Official Account H5, and mini-program `web-view`. The native WeChat mini-program JavaScript/WASM runtime is not supported.

This document describes `web-sdk-pp-ocrv6@0.2.0`. Check [npm](https://www.npmjs.com/package/web-sdk-pp-ocrv6) for publicly available versions and publication status.

## Install

```bash
pnpm add web-sdk-pp-ocrv6
```

```ts
import { createOCR } from "web-sdk-pp-ocrv6";

const ocr = createOCR({
  model: { det: "small", rec: "small" },
  backend: "wasm",
  execution: "worker",
  allowFallback: false,
  onProgress(event) {
    if (event.phase === "download" && event.progress !== undefined) {
      console.log(`Model download ${Math.round(event.progress * 100)}%`);
    }
  },
});
await ocr.load();
const result = await ocr.ocr(file);
await ocr.dispose();
```

`onProgress` reports the `manifest`, `cache`, `download`, `integrity`, `load`, and
`inference` phases. Browsers without a streaming response still report the
download phase but cannot provide a percentage. Exceptions thrown by the callback
do not interrupt the SDK. A full OCR pipeline combines detector and recognizer
network downloads using manifest byte weights.

`wasm` means CPU and `webgpu` means GPU. Explicit selections are strict. Fallback from WebGPU to WASM is permitted only with `backend: "auto"` and `allowFallback: true`.

## New in 0.2.0

- `RuntimeOptions.wasmPaths` configures matching ORT resources in Workers and on the main thread; custom models support explicit `preset` selection.
- `getModelCacheUsage`, `resolveModelCacheIdentity`, and optional `CacheWriter/createWriter` expose cache bytes, model identity, and cleanup invalidation for in-flight writes.
- `initialization`, `timings.loadState`, and `runtime.componentBackends` report historical initialization, current cold/warm state, and actual component backends.

See [API](docs/en/api.md) and [Performance](docs/en/performance.md) for configuration and cancellation/disposal boundaries. Standalone examples are pinned to 0.1.8; each example README documents its API scope and limitations.

## Model distribution

Six official ONNX source files are versioned through Git LFS. The npm package contains SDK code, Worker, types, manifests, and dictionaries, but no ONNX. Browser downloads use CORS-enabled, pinned Hugging Face revision URLs and verify byte count plus SHA-256. GitHub Release remains the versioned archive source. Custom manifests and self-hosted assets are supported.

## Documentation and examples

- [Quick start](docs/en/quick-start.md) · [API](docs/en/api.md) · [Models](docs/en/models.md)
- [Compatibility](docs/en/compatibility.md) · [Performance](docs/en/performance.md) · [Troubleshooting](docs/en/troubleshooting.md)
- [Deployment](docs/en/deployment.md) · [Privacy](docs/en/privacy.md)
- [Vanilla](examples/vanilla) · [React](examples/react) · [Vite](examples/vite) · [CDN](examples/cdn) · [WeChat web-view](examples/wechat-web-view)

Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model provenance and notices.
