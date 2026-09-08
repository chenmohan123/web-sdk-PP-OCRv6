# PP-OCRv6 vanilla 独立示例

本目录可以单独复制使用，固定依赖已发布的 `web-sdk-pp-ocrv6@0.2.0`。需要 Node.js 22+。

```sh
cd examples/vanilla
npm install
npm run dev -- --host 127.0.0.1
npm run build
```

在终端显示的本地地址选择图片并点击“开始识别”。默认 ModelScope，支持显式切换 Hugging Face；选择的来源失败时显示错误，不自动换源。使用 tiny 检测和识别模型，首次运行下载模型，后续可命中 SDK IndexedDB 缓存。

使用公开 `createOCR`、`ocr`、`dispose` 和 AbortSignal。同步禁止重复运行，取消及页面卸载释放会话；React 卸载与开发热更新不会回写旧结果。本示例使用已发布的 0.2.0 API。

Vite 配置从已安装 SDK 的 onnxruntime-web 1.27.0 依赖输出同源 ORT 文件，提供 WASM 主线程运行所需的资源；部署时上传完整 dist 目录，包括 assets 和 ort。模型来自外部模型仓库，图片仅在本机处理。浏览器应支持WebAssembly 和 IndexedDB。

执行 `node examples/tests/consumers.test.mjs` 可从仓库根目录在临时独立目录安装并构建三个示例；浏览器验证记录见 docs 中的本次验证文档。尚未验证的浏览器和设备不能据此声明兼容。

本示例显式使用 `execution: main`，通过同版本 ORT 的 `env.wasm.wasmPaths` 设置资源地址。0.2.0 也支持通过 `RuntimeOptions.wasmPaths` 配置主线程和 Worker 资源，见 [API 文档](../../docs/zh-CN/api.md)。

取消及卸载会停止旧结果回写；本示例向 `ocr` 传入取消信号，由任务的 `finally` 等待收尾并释放会话。SDK 0.2.0 还支持在初始化期间调用 `dispose()` 来取消下载。

通过 `ocr` 懒加载并执行 DET/REC；默认 ModelScope，显式来源失败不会静默切换。

缓存、耗时与取消修复见 [0.2.0 发布说明](../../reports/release/0.2.0.md)。
