# CDN example

Serve this directory over HTTP: `npx serve examples/cdn`. The example imports `web-sdk-pp-ocrv6@0.1.6` from an ESM CDN; pin the exact version and self-host it for production availability.

The npm package does not contain ONNX. Browser runtime model URLs use the CORS-enabled, pinned Hugging Face URLs from the manifest; GitHub Release keeps the versioned archive copies.
