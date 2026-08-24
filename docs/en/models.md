# Models

[中文](../zh-CN/models.md)

Version `1.0.0` pins six official FP32 ONNX assets: medium/small/tiny detection and recognition models. The default small pair balances download size and quality. Exact bytes, parameter counts, opsets, SHA-256 digests, Hugging Face repositories, and pinned revisions are in `models/pp-ocrv6/1.0.0/manifest.json`.

ONNX files are excluded from npm. Browser defaults use CORS-enabled, pinned Hugging Face revision assets and verify byte count and SHA-256 before use. GitHub Release remains the versioned archive source. Custom models must declare tensors, preprocessing, DB postprocessing or dictionary/decoder configuration; the SDK does not infer contracts from filenames.
