# API

[English](../en/api.md)

`createDetector(options)` 仅检测文字区域；`createRecognizer(options)` 识别图片或带稳定索引的裁剪批次；`createOCR(options)` 执行检测、裁剪、排序和识别。每个实例提供 `load()`、运行方法与幂等 `dispose()`。

`backend` 为 `wasm | webgpu | auto`，`execution` 为 `worker | main`。显式 CPU/GPU 请求不会静默回退。运行结果包含 `image`、`model`、`runtime` 和九项 `timings`。稳定错误通过 `PPOCRv6Error.code` 暴露，包括 `INVALID_INPUT`、`MODEL_INTEGRITY_FAILED`、`CAPABILITY_UNSUPPORTED`、`ABORTED` 与 `DISPOSED`。

`RuntimeOptions.onProgress` 可观察 `manifest`、`cache`、`download`、`integrity`、`load` 和 `inference` 阶段。流式响应可提供 `progress`、`loadedBytes` 和 `totalBytes`；不支持 `Response.body` 的浏览器仍报告下载阶段，但不提供百分比。回调异常会被隔离，不会改变加载或推理结果。

使用 `clearModelCache(modelId?, version?)` 清当前版本，使用 `clearAllModelCache()` 清全部模型缓存。

`RuntimeOptions.wasmPaths` 可配置 ONNX Runtime 资源目录（以 `/` 结尾的绝对 URL），也可使用 `{ mjs: "https://cdn.example/ort.mjs", wasm: "https://cdn.example/ort.wasm" }` 指定资源。对象的两个字段均可省略，键名必须为 `mjs` 或 `wasm`，不能使用运行时文件名作为键。配置同时传递到 Worker 和主线程。资源必须与 SDK 依赖的 ONNX Runtime 版本一致；Demo 在开发服务和生产包中提供同版本 `ort/` 资源。

主线程推理取消后，当前调用立即返回 `ABORTED`；后续推理与 `dispose()` 会等待仍在执行的底层计算结束。初始化期间调用 `dispose()` 会取消模型和字典下载，并等待初始化结束后释放已创建的执行器。
