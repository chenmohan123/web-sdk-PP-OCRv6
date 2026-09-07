# PP-OCRv6 react 独立示例

本目录可以单独复制使用，固定依赖已发布的 `web-sdk-pp-ocrv6@0.1.8`。需要 Node.js 22+。

```sh
cd examples/react
npm install
npm run dev -- --host 127.0.0.1
npm run build
```

在终端显示的本地地址选择图片并点击“开始识别”。默认 ModelScope，支持显式切换 Hugging Face；选择的来源失败时显示错误，不自动换源。使用 tiny 检测和识别模型，首次运行下载模型，后续可命中 SDK IndexedDB 缓存。

使用公开 `createOCR`、`ocr`、`dispose` 和 AbortSignal。同步禁止重复运行，取消及页面卸载释放会话；React 卸载与开发热更新不会回写旧结果。此示例不依赖本仓库尚未发布的新 API。

Vite 配置从已安装 SDK 的 onnxruntime-web 1.27.0 依赖输出同源 ORT 文件，提供 WASM 主线程运行所需的资源；部署时上传完整 dist 目录，包括 assets 和 ort。模型来自外部模型仓库，图片仅在本机处理。浏览器应支持WebAssembly 和 IndexedDB。

执行 `node examples/tests/consumers.test.mjs` 可从仓库根目录在临时独立目录安装并构建三个示例；浏览器验证记录见 docs 中的本次验证文档。尚未验证的浏览器和设备不能据此声明兼容。

公开 0.1.8 的 RuntimeOptions 不包含 wasmPaths，因此通过同版本 ORT 的 env.wasm.wasmPaths 设置资源地址，并显式使用 execution: main。Worker 接入见当前仓库 Demo，待后续 SDK 发布后再更新示例。

取消及卸载会立刻停止结果回写，等待已开始的初始化结束后再释放；公开 0.1.8 的初始化不支持安全地提前 dispose。本示例仅对推理传入取消信号。

通过 ocr 懒加载顺序初始化 DET/REC，避免公开 0.1.8 并行 load 在一路失败时提前返回。
