# 兼容性

[English](../en/compatibility.md)

目标环境是支持 WebAssembly、Worker、Canvas 与 Web Crypto 的现代桌面/移动浏览器。GPU 模式还要求 WebGPU。SDK 启动时执行能力检测，并通过 `CAPABILITY_UNSUPPORTED` 拒绝不可用的严格配置。

支持公众号 H5 与微信小程序 `web-view` 中托管的 HTTPS 页面；不支持微信原生小程序 JavaScript/WASM runtime。兼容性表必须记录浏览器版本、系统、设备、后端、执行模式、ORT 版本和测试日期；未实际测试的环境不标为兼容。
