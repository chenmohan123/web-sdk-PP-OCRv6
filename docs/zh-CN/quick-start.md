# 快速开始

[English](../en/quick-start.md)

安装 `pnpm add web-sdk-pp-ocrv6`，然后创建一个可复用实例。默认配置是 `small-det + small-rec`、CPU WASM、Worker 执行。

```ts
import { createOCR } from "web-sdk-pp-ocrv6";
const ocr = createOCR({ model: { det: "small", rec: "small" }, backend: "wasm", execution: "worker", allowFallback: false });
await ocr.load();
const result = await ocr.ocr(file);
console.table(result.lines.map(({ text, recognitionScore }) => ({ text, recognitionScore })));
await ocr.dispose();
```

输入可为 `Blob`、`File`、图片 URL、`ImageBitmap`、`HTMLImageElement` 或 `ImageData`。URL 需要正确的 CORS 响应头。详情见 [API](api.md) 与 [部署](deployment.md)。
