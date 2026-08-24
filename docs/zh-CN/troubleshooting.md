# 故障排查

[English](../en/troubleshooting.md)

- `MODEL_DOWNLOAD_FAILED`：确认 Release 已存在、URL 可访问、响应允许 CORS。
- `MODEL_INTEGRITY_FAILED`：文件大小或 SHA-256 与 manifest 不一致；不要绕过校验，重新发布不可变资产。
- `CAPABILITY_UNSUPPORTED`：改用 `wasm`，或启用 HTTPS、WebGPU/Worker 所需环境。Worker 不可用时显式选择 `execution: "main"`。
- `OUT_OF_MEMORY`：降低输入分辨率或改用 tiny/small，释放不再使用的实例。
- `ABORTED`/`DISPOSED`：检查 AbortSignal 生命周期，并避免复用已释放实例。

跨域隔离仅在启用 WASM 多线程时需要。模型服务器必须返回正确 MIME 类型与 CORS 头。
