# 模型

[English](../en/models.md)

版本 `1.0.0` 固定六个官方 FP32 ONNX：medium/small/tiny 的检测与识别模型。默认组合为 small，兼顾下载体积与精度。准确字节数、参数量、opset、SHA-256、Hugging Face 仓库与固定 revision 见 `models/pp-ocrv6/1.0.0/manifest.json`。

npm 包不包含 ONNX。默认地址是版本化 GitHub Release 资产，加载前验证字节数和 SHA-256。Git LFS 中的文件是发布源；Hugging Face 地址用于来源追踪与备用。自定义模型必须提供完整 tensor、预处理、DB 后处理或字典/解码配置，SDK 不从文件名猜测这些信息。
