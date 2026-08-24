# Privacy

[中文](../zh-CN/privacy.md)

The SDK decodes images and runs ONNX inference locally in the browser by default. It does not upload images, polygons, or OCR text. Default network requests only fetch manifests, dictionaries, ORT runtime assets, and models; those servers may still log ordinary request metadata.

The host application owns any upload, telemetry, logging, and result-retention behavior it adds. Do not place sensitive OCR text in analytics or unprotected console logs. For fully offline use, self-host and precache every resource, then verify in browser developer tools that runs make no external requests.
