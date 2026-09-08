# API

[English](../en/api.md)

`createDetector(options)` 仅检测文字区域；`createRecognizer(options)` 识别图片或带稳定索引的裁剪批次；`createOCR(options)` 执行检测、裁剪、排序和识别。每个实例提供 `load()`、运行方法与幂等 `dispose()`。

`backend` 为 `wasm | webgpu | auto`，`execution` 为 `worker | main`。显式 CPU/GPU 请求不会静默回退。运行结果包含 `image`、`model`、`runtime` 和九项 `timings`。稳定错误通过 `PPOCRv6Error.code` 暴露，包括 `INVALID_INPUT`、`MODEL_INTEGRITY_FAILED`、`CAPABILITY_UNSUPPORTED`、`ABORTED` 与 `DISPOSED`。

`RuntimeOptions.onProgress` 可观察 `manifest`、`cache`、`download`、`integrity`、`load` 和 `inference` 阶段。流式响应可提供 `progress`、`loadedBytes` 和 `totalBytes`；不支持 `Response.body` 的浏览器仍报告下载阶段，但不提供百分比。回调异常会被隔离，不会改变加载或推理结果。

使用 `clearModelCache(modelId?, version?)` 清当前版本，使用 `clearAllModelCache()` 清全部模型缓存。

以下能力属于当前仓库源码，尚未发布到 npm 0.1.8；独立示例仅使用已发布版本的 API。

`getModelCacheUsage(modelId?, version?)` 返回 `{ usage }`，统计本 SDK 实际存储的模型二进制字节；省略参数统计全部，传入模型身份统计当前模型。它不代表整个同源网站的用量或配额。`resolveModelCacheIdentity(selection?, signal?)` 解析模型清单的 `modelId` 和 `version`，不下载模型或创建推理会话。

内置缓存清理会阻止同一 JavaScript 模块环境中清理前启动的下载回填；第三方缓存可通过可选的 `createWriter()` 接入同样的失效控制。SDK 清理只处理存储，Demo 还会取消、等待并释放当前会话。不同标签页之间尚无清理广播协议。

`RuntimeOptions.wasmPaths` 可配置 ONNX Runtime 资源目录（以 `/` 结尾的绝对 URL），也可使用 `{ mjs: "https://cdn.example/ort.mjs", wasm: "https://cdn.example/ort.wasm" }` 指定资源。对象的两个字段均可省略，键名必须为 `mjs` 或 `wasm`，不能使用运行时文件名作为键。配置同时传递到 Worker 和主线程。资源必须与 SDK 依赖的 ONNX Runtime 版本一致；Demo 在开发服务和生产包中提供同版本 `ort/` 资源。

主线程推理取消后，当前调用立即返回 `ABORTED`；后续推理与 `dispose()` 会等待仍在执行的底层计算结束。初始化期间调用 `dispose()` 会取消模型和字典下载，并等待初始化结束后释放已创建的执行器。

源码新增的可选 `InitializationTiming`、实例 `initialization`、`timings.initialization`、`timings.loadState` 和 `runtime.componentBackends` 尚未发布到 npm 0.1.8。初始化记录为历史分项；显式 `load()` 完成后的首次运行已属于热运行。OCR 顶层 `actualBackend` 为 DET 实际后端，混合后端必须读取 `componentBackends`。完整语义见 [性能](performance.md)。
