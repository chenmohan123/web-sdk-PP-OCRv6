# PP-OCRv6 微信 web-view

固定使用已发布的 `web-sdk-pp-ocrv6@0.2.0` 和 `onnxruntime-web@1.27.0`，无需构建。从仓库根目录启动：

```sh
npx --yes http-server@14.1.1 examples/wechat-web-view -p 8080 -c-1
```

打开 http://127.0.0.1:8080 ，选择图片并运行。部署时将本目录完整放在 HTTPS 静态站点。默认 ModelScope，可选择 Hugging Face；显式来源失败显示错误，不静默换源。

import map 解析已发布 SDK 的 ORT 依赖，ORT 的 mjs/wasm 来自同版本 CDN。此示例显式使用 WASM 主线程，因为跨域模块 Worker 无法直接引用 CDN SDK 的相对 Worker；Worker 接入见当前仓库 Demo，vanilla/react/vite 也使用公开版本支持的主线程配置。使用公开 ocr/dispose 与 AbortSignal，重复运行互斥，取消与页面离开释放实例。取消会等待已开始的底层计算退出。

仅面向公众号 H5 和小程序 web-view；原生小程序运行时不支持。上线需配置微信业务域名，并在目标微信版本验证 import map、WebAssembly、文件选择和网络访问。桌面 Chromium 测试不能证明微信设备兼容。

取消及卸载会停止旧结果回写；本示例向 `ocr` 传入取消信号，由任务的 `finally` 等待收尾并释放会话。SDK 0.2.0 还支持在初始化期间调用 `dispose()` 来取消下载。

通过 `ocr` 懒加载并执行 DET/REC；默认 ModelScope，显式来源失败不会静默切换。

缓存、耗时与取消修复见 [0.2.0 发布说明](../../reports/release/0.2.0.md)。
