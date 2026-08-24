# 性能

[English](../en/performance.md)

冷启动包含模型下载、缓存读取、SHA-256、会话创建；热运行复用已加载会话。结果分别提供 `modelDownloadMs`、`modelCacheReadMs`、`integrityMs`、`sessionMs`、`decodeMs`、`preprocessMs`、`inferenceMs`、`postprocessMs` 与 `totalMs`。

移动端建议从 tiny 或 small 开始。WASM 是默认且覆盖面最广；WebGPU 可能更快，但收益受浏览器、GPU、驱动、输入大小影响。比较 CPU/GPU 时应使用同一设备、同一模型、同一输入，并分别记录冷启动和至少多次热运行。
