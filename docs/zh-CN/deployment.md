# 部署

[English](../en/deployment.md)

生产页面必须使用 HTTPS 才能稳定使用 WebGPU、Worker 和 Web Crypto。将 Demo 静态文件、ORT WASM/Worker 文件与模型放在可跨域读取的地址；模型响应建议包含长期不可变缓存头，因为 URL 与 SHA-256 已版本化。

自托管时复制 runtime manifest、字典和 ONNX，更新每个资产的绝对 URL、真实字节数和 SHA-256。自定义入口使用 `model: { det: { manifestUrl }, rec: { manifestUrl } }`。公众号 H5 和小程序 `web-view` 需配置业务域名；微信原生小程序 runtime 不支持。
