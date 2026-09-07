# API

[中文](../zh-CN/api.md)

`createDetector(options)` finds text regions. `createRecognizer(options)` recognizes an image or indexed crop batch. `createOCR(options)` performs detection, crop, reading-order sort, and recognition. Each instance exposes `load()`, its run method, and idempotent `dispose()`.

`backend` is `wasm | webgpu | auto`; `execution` is `worker | main`. Explicit CPU/GPU requests never silently fall back. Results include `image`, `model`, `runtime`, and nine `timings` fields. Stable failures use `PPOCRv6Error.code`, including `INVALID_INPUT`, `MODEL_INTEGRITY_FAILED`, `CAPABILITY_UNSUPPORTED`, `ABORTED`, and `DISPOSED`.

`RuntimeOptions.onProgress` observes the `manifest`, `cache`, `download`, `integrity`, `load`, and `inference` phases. Streaming responses provide `progress`, `loadedBytes`, and `totalBytes`; browsers without `Response.body` still report the download phase without a percentage. Callback exceptions are isolated and do not change loading or inference results.

Use `clearModelCache(modelId?, version?)` for the current version and `clearAllModelCache()` for all model entries.

`RuntimeOptions.wasmPaths` 可配置 ONNX Runtime 资源目录（以 `/` 结尾的绝对 URL），也可使用 `{ mjs: "https://cdn.example/ort.mjs", wasm: "https://cdn.example/ort.wasm" }` 指定资源。对象的两个字段均可省略，键名必须为 `mjs` 或 `wasm`，不能使用运行时文件名作为键。配置同时传递到 Worker 和主线程。资源必须与 SDK 依赖的 ONNX Runtime 版本一致；Demo 在开发服务和生产包中提供同版本 `ort/` 资源。

主线程推理取消后，当前调用立即返回 `ABORTED`；后续推理与 `dispose()` 会等待仍在执行的底层计算结束。初始化期间调用 `dispose()` 会取消模型和字典下载，并等待初始化结束后释放已创建的执行器。
