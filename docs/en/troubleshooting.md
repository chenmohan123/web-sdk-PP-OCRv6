# Troubleshooting

[中文](../zh-CN/troubleshooting.md)

- `MODEL_DOWNLOAD_FAILED`: confirm the pinned Hugging Face URL is reachable, or that a self-hosted model server permits CORS.
- `MODEL_INTEGRITY_FAILED`: bytes or SHA-256 differ from the manifest. Do not bypass verification; republish immutable assets.
- `CAPABILITY_UNSUPPORTED`: choose `wasm`, or enable HTTPS and required WebGPU/Worker support. Select `execution: "main"` explicitly when Worker is unavailable.
- `OUT_OF_MEMORY`: reduce input resolution or choose tiny/small, then dispose unused instances.
- `ABORTED`/`DISPOSED`: check AbortSignal lifetime and do not reuse released instances.

Cross-origin isolation is required only for WASM threads. Model servers need correct MIME and CORS response headers.
