# CDN example

Serve this directory over HTTP: `npx serve examples/cdn`. The example imports `web-sdk-pp-ocrv6@0.1.0` from an ESM CDN; pin the exact version and self-host it for production availability.

The npm package does not contain ONNX. Runtime model URLs remain the versioned, integrity-checked Release URLs from the manifest.
