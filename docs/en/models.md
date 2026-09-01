# Models

[中文](../zh-CN/models.md)

The current manifest pins six official FP32 ONNX assets: medium/small/tiny detection and recognition models. The default small pair balances download size and quality. Exact bytes, parameter counts, opsets, SHA-256 digests, Hugging Face repositories, and pinned revisions are in `models/pp-ocrv6/manifest.json`; `model.version` is contract metadata for the current files, not a directory version.

ONNX files are excluded from npm. Browser defaults use CORS-enabled, pinned Hugging Face revision assets and verify byte count and SHA-256 before use. The repository root is the only runtime and publication location for the current model; updates replace those files directly, while historical revisions remain source evidence. Custom models must declare tensors, preprocessing, DB postprocessing or dictionary/decoder configuration; the SDK does not infer contracts from filenames.
