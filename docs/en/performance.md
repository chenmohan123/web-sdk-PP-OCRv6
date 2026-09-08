# Performance

Older custom components may omit `loadState`. Aggregation reports `cold` when any executed component explicitly reports it, and `warm` only when every executed component explicitly reports `warm`. Otherwise the field is omitted, preserving unknown state.

[中文](../zh-CN/performance.md)

The timing fixes and optional fields below belong to the current repository source and are not published in npm 0.1.8. Standalone integration examples remain pinned to public 0.1.8.

Results retain nine millisecond fields: `modelDownloadMs`, `modelCacheReadMs`, `integrityMs`, `sessionMs`, `decodeMs`, `preprocessMs`, `inferenceMs`, `postprocessMs`, and `totalMs`. They describe the current call. Public detector/recognizer `totalMs` spans method entry through completion, including initialization and instance queue waits. OCR pipeline `totalMs` starts when its own queued work begins.

| Scenario | `timings.loadState` | Current loading phases | Initialization record |
| --- | --- | --- | --- |
| First run triggers initialization without prior `load()` | `cold` | Includes model acquisition, verification, and session creation started by this call | Available on the result and instance |
| New instance acquires cached model bytes and creates a session | `cold` | Download is zero; cache read, integrity, and session creation are measured | `source: "cache"` |
| First run after explicit `await load()` completes | `warm` | All four loading phases are zero | Historical initialization is retained |
| Subsequent run on an already loaded instance | `warm` | All four loading phases are zero | The same initialization record is retained |
| Call joins an unfinished `load()` or another initialization | `cold` | Loading work belongs to its original initiator, so this call reports zero loading phases; its remaining wait is included in `totalMs` | Full historical phases are separate |

`timings.initialization` and the optional read-only instance `initialization` expose the four initial loading phases. This historical record is excluded from warm `totalMs`; do not add it to current timings. Public factories also expose `source: "network" | "cache" | "mixed"`. Full OCR may download one component and read the other from cache. A cache hit is not a warm run: a new session still needs initialization.

`sessionMs` measures public factory session acquisition, including failed automatic fallback candidates and Worker startup/handshake. Model phases cover ONNX acquisition and integrity only; manifest parsing, recognition dictionary downloads, queue waits, and orchestration are included in elapsed totals. The nine fields need not sum to `totalMs`. Full OCR phases accumulate DET/REC work. Explicit `load()` initializes both in parallel, so historical phase sums can exceed elapsed wait time.

The Demo measures the actual `load()` wait and then runs the loaded session. The first invocation is labeled “Cold start (new session)” and later invocations “Warm run (reused session)”. “Current end-to-end” includes session acquisition/replacement and inference; “Current initialization wait” reports measured elapsed loading and is zero for warm runs. “Current SDK run” and its phases follow SDK call boundaries. The expandable “Initial loading phases” is explicitly historical; download plus session time is no longer presented as CPU/GPU cold-start wait.

OCR entry image decoding contributes to `decodeMs`, alongside actual component decoding. Empty detection results skip REC: all recognition phases and `stageTimings.recognitionMs` are zero. `stageTimings` are separate pipeline observations and must not be added again to `timings`.

`runtime` retains requested/actual backend, execution mode, and ONNX Runtime version. OCR adds `componentBackends` for the actual `det` and optional `rec` execution. Empty results omit `rec` because it did not execute. To preserve the existing field type, top-level OCR `actualBackend` identifies DET. If components differ, read `componentBackends`; the top-level value does not claim a unified GPU backend. The Demo lists executed components with their actual backends, and later control changes do not rewrite an existing result's runtime.

Full OCR download progress remains weighted by actual DET/REC network bytes, excluding cached models from its denominator. Start with tiny or small on mobile. CPU/GPU comparisons should fix device, browser, model, and input, recording new-session initialization, cache initialization, and repeated warm runs separately. See the [2026-09-08 validation record](../validation/runtime-performance-2026-09-08.md). Environment-specific observations are not compatibility claims for other devices or NPU.
