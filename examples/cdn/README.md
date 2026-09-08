# PP-OCRv6 CDN

固定使用已发布的 `web-sdk-pp-ocrv6@0.1.8` 和 `onnxruntime-web@1.27.0`，无需构建。从仓库根目录启动：

```sh
npx --yes http-server@14.1.1 examples/cdn -p 8080 -c-1
```

打开 http://127.0.0.1:8080 ，选择图片并运行。部署时将本目录完整放在 HTTPS 静态站点。默认 ModelScope，可选择 Hugging Face；显式来源失败显示错误，不静默换源。

import map 解析已发布 SDK 的 ORT 依赖，ORT 的 mjs/wasm 来自同版本 CDN。此示例显式使用 WASM 主线程，因为跨域模块 Worker 无法直接引用 CDN SDK 的相对 Worker；Worker 接入见当前仓库 Demo，vanilla/react/vite 也使用公开版本支持的主线程配置。使用公开 ocr/dispose 与 AbortSignal，重复运行互斥，取消与页面离开释放实例。取消会等待已开始的底层计算退出。

需要支持 import map、ES module、WebAssembly 和 IndexedDB 的浏览器。CDN 与模型仓库需要能访问；图片不会上传。

取消及卸载会立刻停止结果回写，等待已开始的初始化结束后再释放；公开 0.1.8 的初始化不支持安全地提前 dispose。本示例仅对推理传入取消信号。

通过 ocr 懒加载顺序初始化 DET/REC，避免公开 0.1.8 并行 load 在一路失败时提前返回。

0.2.0 支持初始化取消/释放与 `RuntimeOptions.wasmPaths`；以上限制仅针对本示例固定使用的 0.1.8，版本差异见 [0.2.0 发布说明](../../reports/release/0.2.0.md)。
