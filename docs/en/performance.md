# Performance

[中文](../zh-CN/performance.md)

Cold start includes model download, cache read, SHA-256, and session creation. Warm runs reuse loaded sessions. Results expose `modelDownloadMs`, `modelCacheReadMs`, `integrityMs`, `sessionMs`, `decodeMs`, `preprocessMs`, `inferenceMs`, `postprocessMs`, and `totalMs` separately.

Start with tiny or small on mobile. WASM is the widest-coverage default; WebGPU can be faster, but results depend on browser, GPU, driver, and input size. CPU/GPU comparisons should use the same device, model, and input, reporting cold start plus multiple warm runs.
