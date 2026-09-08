# API

[中文](../zh-CN/api.md)

`createDetector(options)` finds text regions. `createRecognizer(options)` recognizes an image or indexed crop batch. `createOCR(options)` performs detection, crop, reading-order sort, and recognition. Each instance exposes `load()`, its run method, and idempotent `dispose()`.

`backend` is `wasm | webgpu | auto`; `execution` is `worker | main`. Explicit CPU/GPU requests never silently fall back. Results include `image`, `model`, `runtime`, and nine `timings` fields. Stable failures use `PPOCRv6Error.code`, including `INVALID_INPUT`, `MODEL_INTEGRITY_FAILED`, `CAPABILITY_UNSUPPORTED`, `ABORTED`, and `DISPOSED`.

`RuntimeOptions.onProgress` observes the `manifest`, `cache`, `download`, `integrity`, `load`, and `inference` phases. Streaming responses provide `progress`, `loadedBytes`, and `totalBytes`; browsers without `Response.body` still report the download phase without a percentage. Callback exceptions are isolated and do not change loading or inference results.

Use `clearModelCache(modelId?, version?)` for the current version and `clearAllModelCache()` for all model entries.

The cache, resource configuration, and initialization observability APIs below are available from 0.2.0.

`getModelCacheUsage(modelId?, version?)` returns `{ usage }`: model binary bytes actually stored by this SDK. Omit both arguments for all models or provide the model identity to restrict the result. It does not report the entire origin's storage usage or quota. `resolveModelCacheIdentity(selection?, signal?)` resolves the manifest's `modelId` and `version` without downloading models or creating inference sessions.

Built-in cache cleanup prevents downloads started before cleanup in the same JavaScript module environment from writing back. Third-party caches can implement optional `createWriter()` with `CacheWriter` for equivalent invalidation. SDK cleanup only handles storage; the Demo also cancels, waits for, and disposes the current session. Cross-tab invalidation broadcasts are not implemented.

`RuntimeOptions.wasmPaths` accepts an absolute ONNX Runtime resource directory ending in `/`, or `{ mjs: "https://cdn.example/ort.mjs", wasm: "https://cdn.example/ort.wasm" }`. Both object fields are optional; valid keys are `mjs` and `wasm`, not runtime filenames. The option reaches both Worker and main-thread execution. Resources must match the SDK's ONNX Runtime dependency version. The Demo serves matching `ort/` resources during development and in production builds.

Custom models accept `{ manifestUrl, preset: "tiny" }` or `{ manifest, preset: "tiny" }` to select a manifest preset; omitting it keeps the default preset.

Canceling main-thread inference rejects the current call with `ABORTED` immediately; subsequent inference and `dispose()` wait for ongoing underlying computation. Calling `dispose()` during initialization cancels model and dictionary downloads, waits for initialization to settle, and releases executors already created.

0.2.0 adds optional `InitializationTiming`, instance `initialization`, `timings.initialization`, `timings.loadState`, and `runtime.componentBackends`. Initialization is historical; the first run after explicit `load()` completion is warm. Top-level OCR `actualBackend` identifies DET; mixed execution requires reading `componentBackends`. See [Performance](performance.md) for boundaries.
