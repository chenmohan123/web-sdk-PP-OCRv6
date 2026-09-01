# 模型

[English](../en/models.md)

当前清单固定六个官方 FP32 ONNX：medium/small/tiny 的检测与识别模型。默认组合为 small，兼顾下载体积与精度。准确字节数、参数量、opset、SHA-256、Hugging Face 仓库与固定 revision 见 `models/pp-ocrv6/manifest.json`；`model.version` 仅是当前契约元数据，不代表目录版本。

npm 包不包含 ONNX。浏览器默认地址是带 CORS 的 Hugging Face 固定 revision 资产，加载前验证字节数和 SHA-256；仓库根目录是当前模型的唯一运行/发布位置，更新时直接替换文件，历史 revision 仅作为来源证据保留。自定义模型必须提供完整 tensor、预处理、DB 后处理或字典/解码配置，SDK 不从文件名猜测这些信息。
