# Changelog

## 0.1.6 - 2026-08-25

- 修复 CTC recognition 字典未包含 PaddleOCR `use_space_char` 追加的 ASCII 空格，确保字典条目数与模型输出类别数一致。

## 0.1.5 - 2026-08-25

- 修复 PP-OCRv6 recognition 字典丢失全角空格导致的中文字符索引错位，并在 SDK 加载时校验字典与模型输出类别数量。

## 0.1.4 - 2026-08-25

- Use Node 24 in the npm Trusted Publisher workflow to meet the npm OIDC CLI runtime requirement.

## 0.1.3 - 2026-08-25

- Fix npm Trusted Publisher OIDC publishing by removing the setup-node registry placeholder token and normalizing the repository URL.

## 0.1.2 - 2026-08-25

- Add repository metadata to the published package so npm Trusted Publisher can verify the GitHub source repository.

## 0.1.1 - 2026-08-24

- Fix Demo image preview repaint after sample selection and file upload.
- Use CORS-enabled pinned Hugging Face model URLs as browser defaults; keep GitHub Release assets as the versioned archive source.

## 0.1.0 - 2026-08-24

- Initial Apache-2.0 release of `web-sdk-pp-ocrv6`.
- Uses official PaddlePaddle PP-OCRv6 medium/small/tiny detection and recognition ONNX assets, pinned by Hugging Face revisions and SHA-256 in the runtime manifest.
- Default assets are `small-det` and `small-rec`; CPU WASM is the default backend and WebGPU is available when the browser supports it.
- Includes Worker/main execution, model integrity verification, versioned memory/IndexedDB cache, detector, recognizer, and `det -> crop -> rec` OCR pipeline.
- The npm package excludes ONNX binaries; release assets are published separately from Git LFS sources.
- Browser, mobile H5, Official Account H5, and mini-program `web-view` are target surfaces. Native mini-program runtime is not supported.
