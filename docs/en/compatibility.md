# Compatibility

[中文](../zh-CN/compatibility.md)

Targets are modern desktop/mobile browsers with WebAssembly, Worker, Canvas, and Web Crypto. GPU mode additionally requires WebGPU. Startup capability probing rejects unavailable strict configurations with `CAPABILITY_UNSUPPORTED`.

HTTPS pages hosted in WeChat Official Account H5 and mini-program `web-view` are supported targets. The native WeChat mini-program JavaScript/WASM runtime is not supported. Compatibility evidence must record browser version, OS, device, backend, execution mode, ORT version, and test date; untested environments are not claimed compatible.
