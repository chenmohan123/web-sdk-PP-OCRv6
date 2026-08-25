# API

[English](../en/api.md)

`createDetector(options)` 仅检测文字区域；`createRecognizer(options)` 识别图片或带稳定索引的裁剪批次；`createOCR(options)` 执行检测、裁剪、排序和识别。每个实例提供 `load()`、运行方法与幂等 `dispose()`。

`backend` 为 `wasm | webgpu | auto`，`execution` 为 `worker | main`。显式 CPU/GPU 请求不会静默回退。运行结果包含 `image`、`model`、`runtime` 和九项 `timings`。稳定错误通过 `PPOCRv6Error.code` 暴露，包括 `INVALID_INPUT`、`MODEL_INTEGRITY_FAILED`、`CAPABILITY_UNSUPPORTED`、`ABORTED` 与 `DISPOSED`。

`RuntimeOptions.onProgress` 可观察 `manifest`、`cache`、`download`、`integrity`、`load` 和 `inference` 阶段。流式响应可提供 `progress`、`loadedBytes` 和 `totalBytes`；不支持 `Response.body` 的浏览器仍报告下载阶段，但不提供百分比。回调异常会被隔离，不会改变加载或推理结果。

使用 `clearModelCache(modelId?, version?)` 清当前版本，使用 `clearAllModelCache()` 清全部模型缓存。
