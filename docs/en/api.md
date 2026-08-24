# API

[中文](../zh-CN/api.md)

`createDetector(options)` finds text regions. `createRecognizer(options)` recognizes an image or indexed crop batch. `createOCR(options)` performs detection, crop, reading-order sort, and recognition. Each instance exposes `load()`, its run method, and idempotent `dispose()`.

`backend` is `wasm | webgpu | auto`; `execution` is `worker | main`. Explicit CPU/GPU requests never silently fall back. Results include `image`, `model`, `runtime`, and nine `timings` fields. Stable failures use `PPOCRv6Error.code`, including `INVALID_INPUT`, `MODEL_INTEGRITY_FAILED`, `CAPABILITY_UNSUPPORTED`, `ABORTED`, and `DISPOSED`.

Use `clearModelCache(modelId?, version?)` for the current version and `clearAllModelCache()` for all model entries.
