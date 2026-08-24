# Deployment

[中文](../zh-CN/deployment.md)

Production pages should use HTTPS for reliable WebGPU, Worker, and Web Crypto access. Host the Demo static files, ORT WASM/Worker resources, and models on CORS-readable origins. Immutable cache headers are recommended because URLs and SHA-256 values are versioned.

For self-hosting, copy the runtime manifest, dictionaries, and ONNX files, then update absolute URLs, exact bytes, and SHA-256. Select it through `model: { det: { manifestUrl }, rec: { manifestUrl } }`. Configure business domains for WeChat Official Account H5 and mini-program `web-view`; native mini-program runtime is not supported.
