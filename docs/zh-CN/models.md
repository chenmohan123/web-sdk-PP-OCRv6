# 模型

[English](../en/models.md)

版本 `1.0.0` 固定六个官方 FP32 ONNX：medium/small/tiny 的检测与识别模型。默认组合为 small，兼顾下载体积与精度。准确字节数、参数量、opset、SHA-256、Hugging Face 仓库与固定 revision 见 `models/pp-ocrv6/1.0.0/manifest.json`。

npm 包不包含 ONNX。浏览器默认地址是带 CORS 的 Hugging Face 固定 revision 资产，加载前验证字节数和 SHA-256；GitHub Release 是版本化归档源。自定义模型必须提供完整 tensor、预处理、DB 后处理或字典/解码配置，SDK 不从文件名猜测这些信息。
