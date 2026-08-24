# Changelog

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
