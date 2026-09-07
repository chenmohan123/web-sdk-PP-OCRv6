# API

[中文](../zh-CN/api.md)

`createDetector(options)` finds text regions. `createRecognizer(options)` recognizes an image or indexed crop batch. `createOCR(options)` performs detection, crop, reading-order sort, and recognition. Each instance exposes `load()`, its run method, and idempotent `dispose()`.

`backend` is `wasm | webgpu | auto`; `execution` is `worker | main`. Explicit CPU/GPU requests never silently fall back. Results include `image`, `model`, `runtime`, and nine `timings` fields. Stable failures use `PPOCRv6Error.code`, including `INVALID_INPUT`, `MODEL_INTEGRITY_FAILED`, `CAPABILITY_UNSUPPORTED`, `ABORTED`, and `DISPOSED`.

`RuntimeOptions.onProgress` observes the `manifest`, `cache`, `download`, `integrity`, `load`, and `inference` phases. Streaming responses provide `progress`, `loadedBytes`, and `totalBytes`; browsers without `Response.body` still report the download phase without a percentage. Callback exceptions are isolated and do not change loading or inference results.

Use `clearModelCache(modelId?, version?)` for the current version and `clearAllModelCache()` for all model entries.

以下能力属于当前仓库源码，尚未发布到 npm 0.1.8；独立示例仅使用已发布版本的 API。

`getModelCacheUsage(modelId?, version?)` 返回 `{ usage }`，统计本 SDK 实际存储的模型二进制字节；省略参数统计全部，传入模型身份统计当前模型。它不代表整个同源网站的用量或配额。`resolveModelCacheIdentity(selection?, signal?)` 解析模型清单的 `modelId` 和 `version`，不下载模型或创建推理会话。

内置缓存清理会阻止同一 JavaScript 模块环境中清理前启动的下载回填；第三方缓存可通过可选的 `createWriter()` 接入同样的失效控制。SDK 清理只处理存储，Demo 还会取消、等待并释放当前会话。不同标签页之间尚无清理广播协议。

`RuntimeOptions.wasmPaths` 可配置 ONNX Runtime 资源目录（以 `/` 结尾的绝对 URL），也可使用 `{ mjs: "https://cdn.example/ort.mjs", wasm: "https://cdn.example/ort.wasm" }` 指定资源。对象的两个字段均可省略，键名必须为 `mjs` 或 `wasm`，不能使用运行时文件名作为键。配置同时传递到 Worker 和主线程。资源必须与 SDK 依赖的 ONNX Runtime 版本一致；Demo 在开发服务和生产包中提供同版本 `ort/` 资源。

主线程推理取消后，当前调用立即返回 `ABORTED`；后续推理与 `dispose()` 会等待仍在执行的底层计算结束。初始化期间调用 `dispose()` 会取消模型和字典下载，并等待初始化结束后释放已创建的执行器。
