# web-sdk-PP-OCRv6

[English](README.en.md) · [GitHub](https://github.com/chenmohan123/web-sdk-PP-OCRv6) · [npm](https://www.npmjs.com/package/web-sdk-pp-ocrv6) · [在线 Demo](https://chenmohan123.github.io/web-sdk-PP-OCRv6/)

框架无关的浏览器端 PP-OCRv6 SDK，使用 ONNX Runtime Web 在本地完成文本检测、文本识别和 `det -> crop -> rec` OCR。支持桌面和移动端浏览器、公众号 H5、微信小程序 `web-view`；不支持微信原生小程序 JavaScript/WASM runtime。

## 安装

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
});
const result = await ocr.ocr(file);
await ocr.dispose();
```

`wasm` 是 CPU，`webgpu` 是 GPU。显式选择严格执行；只有 `backend: "auto"` 且 `allowFallback: true` 时，SDK 才可从 WebGPU 回退到 WASM。

## 模型分发

六个官方 ONNX 源文件由 Git LFS 版本化保存。npm 包只包含 SDK、Worker、类型、manifest 和字典，不包含 ONNX。浏览器默认从带 CORS 的 Hugging Face 固定 revision 地址下载并校验文件大小与 SHA-256；GitHub Release 保留为版本化归档源。用户可提供自定义 manifest 与自托管模型。

## 文档与示例

- [快速开始](docs/zh-CN/quick-start.md) · [API](docs/zh-CN/api.md) · [模型](docs/zh-CN/models.md)
- [兼容性](docs/zh-CN/compatibility.md) · [性能](docs/zh-CN/performance.md) · [故障排查](docs/zh-CN/troubleshooting.md)
- [部署](docs/zh-CN/deployment.md) · [隐私](docs/zh-CN/privacy.md)
- [Vanilla](examples/vanilla) · [React](examples/react) · [Vite](examples/vite) · [CDN](examples/cdn) · [微信 web-view](examples/wechat-web-view)

Apache-2.0，模型来源与第三方声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
