# 性能

[English](../en/performance.md)

冷启动包含模型下载、缓存读取、SHA-256、会话创建；热运行复用已加载会话。结果分别提供 `modelDownloadMs`、`modelCacheReadMs`、`integrityMs`、`sessionMs`、`decodeMs`、`preprocessMs`、`inferenceMs`、`postprocessMs` 与 `totalMs`。

Demo 将 `modelDownloadMs` 单独显示为模型下载耗时，将 `sessionMs` 显示为模型加载耗时；缓存读取和完整性校验作为辅助行显示。完整 OCR 的下载进度按检测与识别模型的实际网络字节加权，缓存命中的模型不进入下载分母。

移动端建议从 tiny 或 small 开始。WASM 是默认且覆盖面最广；WebGPU 可能更快，但收益受浏览器、GPU、驱动、输入大小影响。比较 CPU/GPU 时应使用同一设备、同一模型、同一输入，并分别记录冷启动和至少多次热运行。
