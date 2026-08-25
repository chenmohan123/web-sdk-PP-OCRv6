# web-sdk-PP-OCRv6

[中文（默认）](README.md) · [GitHub](https://github.com/chenmohan123/web-sdk-PP-OCRv6) · [npm](https://www.npmjs.com/package/web-sdk-pp-ocrv6) · [Live Demo](https://chenmohan123.github.io/web-sdk-PP-OCRv6/)

A framework-neutral browser SDK for PP-OCRv6 text detection, recognition, and the complete `det -> crop -> rec` OCR pipeline through ONNX Runtime Web. It targets desktop/mobile browsers, WeChat Official Account H5, and mini-program `web-view`. The native WeChat mini-program JavaScript/WASM runtime is not supported.

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

## Model distribution

Six official ONNX source files are versioned through Git LFS. The npm package contains SDK code, Worker, types, manifests, and dictionaries, but no ONNX. Browser downloads use CORS-enabled, pinned Hugging Face revision URLs and verify byte count plus SHA-256. GitHub Release remains the versioned archive source. Custom manifests and self-hosted assets are supported.

## Documentation and examples

- [Quick start](docs/en/quick-start.md) · [API](docs/en/api.md) · [Models](docs/en/models.md)
- [Compatibility](docs/en/compatibility.md) · [Performance](docs/en/performance.md) · [Troubleshooting](docs/en/troubleshooting.md)
- [Deployment](docs/en/deployment.md) · [Privacy](docs/en/privacy.md)
- [Vanilla](examples/vanilla) · [React](examples/react) · [Vite](examples/vite) · [CDN](examples/cdn) · [WeChat web-view](examples/wechat-web-view)

Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model provenance and notices.
