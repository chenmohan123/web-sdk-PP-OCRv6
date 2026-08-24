# Quick start

[中文](../zh-CN/quick-start.md)

Install with `pnpm add web-sdk-pp-ocrv6`. The defaults are `small-det + small-rec`, CPU WASM, and Worker execution.

```ts
import { createOCR } from "web-sdk-pp-ocrv6";
const ocr = createOCR({ model: { det: "small", rec: "small" }, backend: "wasm", execution: "worker", allowFallback: false });
await ocr.load();
const result = await ocr.ocr(file);
console.table(result.lines.map(({ text, recognitionScore }) => ({ text, recognitionScore })));
await ocr.dispose();
```

Inputs may be `Blob`, `File`, image URL, `ImageBitmap`, `HTMLImageElement`, or `ImageData`. URL inputs require correct CORS response headers. See [API](api.md) and [deployment](deployment.md).
