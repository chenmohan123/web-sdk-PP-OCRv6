# web-sdk-pp-ocrv6

[English](#english) · [在线 Demo](https://chenmohan123.github.io/web-sdk-PP-OCRv6/) · [GitHub](https://github.com/chenmohan123/web-sdk-PP-OCRv6)

框架无关的浏览器端 PP-OCRv6 SDK，使用 ONNX Runtime Web 在本地完成文本检测、文本识别和 `det -> crop -> rec` OCR。支持桌面和移动端浏览器、公众号 H5、微信小程序 `web-view`；不支持微信原生小程序 JavaScript/WASM runtime。

## 安装

```bash
pnpm add web-sdk-pp-ocrv6
```

也可以使用 `npm install web-sdk-pp-ocrv6`。

## 快速开始

```ts
import { createOCR } from "web-sdk-pp-ocrv6";

const ocr = createOCR({
  model: { det: "small", rec: "small" },
  backend: "wasm",
  execution: "worker",
  allowFallback: false,
  onProgress(event) {
    if (event.phase === "download" && event.progress !== undefined) {
      console.log(`模型下载 ${Math.round(event.progress * 100)}%`);
    }
  },
});

await ocr.load();
const result = await ocr.ocr(file);
console.table(result.lines);
await ocr.dispose();
```

`onProgress` 会报告 `manifest`、`cache`、`download`、`integrity`、`load` 和 `inference` 阶段。`wasm` 表示 CPU，`webgpu` 表示 GPU。显式选择严格执行；只有 `backend: "auto"` 且 `allowFallback: true` 时，SDK 才可从 WebGPU 回退到 WASM。

## 模型分发

npm 包包含 SDK、Worker、类型、manifest 和识别字典，不包含 ONNX 模型。浏览器默认从带 CORS 的固定版本地址下载模型，并校验文件大小和 SHA-256；也支持自定义 manifest 与自托管模型。

## 文档与示例

- [快速开始](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/quick-start.md) · [API](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/api.md) · [模型](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/models.md)
- [兼容性](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/compatibility.md) · [性能](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/performance.md) · [故障排查](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/troubleshooting.md)
- [部署](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/deployment.md) · [隐私](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/docs/zh-CN/privacy.md) · [示例](https://github.com/chenmohan123/web-sdk-PP-OCRv6/tree/main/examples)

## English

A framework-neutral browser SDK for PP-OCRv6 text detection, recognition, and the complete `det -> crop -> rec` OCR pipeline through ONNX Runtime Web. It targets desktop and mobile browsers, WeChat Official Account H5, and mini-program `web-view`. The native WeChat mini-program JavaScript/WASM runtime is not supported.

```bash
npm install web-sdk-pp-ocrv6
```

```ts
import { createOCR } from "web-sdk-pp-ocrv6";

const ocr = createOCR({
  model: { det: "small", rec: "small" },
  backend: "wasm",
  execution: "worker",
  allowFallback: false,
});

await ocr.load();
const result = await ocr.ocr(file);
console.table(result.lines);
await ocr.dispose();
```

The npm package contains the SDK, Worker, types, manifest, and recognition dictionaries, but no ONNX models. Browsers download pinned model assets with CORS support and verify their byte size and SHA-256 digest. Custom manifests and self-hosted models are supported.

See the [English documentation](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/README.en.md), [examples](https://github.com/chenmohan123/web-sdk-PP-OCRv6/tree/main/examples), and [live Demo](https://chenmohan123.github.io/web-sdk-PP-OCRv6/).

Apache-2.0. Model provenance and third-party notices are available in [THIRD_PARTY_NOTICES.md](https://github.com/chenmohan123/web-sdk-PP-OCRv6/blob/main/THIRD_PARTY_NOTICES.md).
