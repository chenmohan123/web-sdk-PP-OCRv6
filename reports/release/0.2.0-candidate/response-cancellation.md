# 响应体取消回归

2026-09-08，候选包浏览器验证发现模型响应流被主动取消时误报
`MODEL_DOWNLOAD_FAILED`。对相邻清单和识别字典读取路径的复查还发现：
清单响应体取消会误报 `INVALID_MANIFEST`，字典响应体取消会泄漏原始
`DOMException`，没有 SDK 的 `ABORTED` 字符串错误码。

修复位置为 `packages/sdk/src/model/download.ts` 与
`packages/sdk/src/factory.ts`。响应体读取异常时依据对应 AbortSignal
区分主动取消和真实失败；已有会话仍沿失败路径释放。

回归证据：

- `packages/sdk/tests/download.test.ts`：模型响应流取消与未取消的断流
  分别断言 `ABORTED`、`MODEL_DOWNLOAD_FAILED`，红绿结果见同目录日志。
- `packages/sdk/tests/factory-lifecycle.test.ts`：主任务新增两项成功取得
  HTTP 响应后、读取响应体期间释放的测试。修复前 2 项失败、原有 8 项
  通过；修复后 10 项全部通过。清单取消不创建执行器，字典取消后执行器
  只释放一次。

命令在 `packages/sdk` 运行：

```powershell
node ../../node_modules/vitest/vitest.mjs run tests/factory-lifecycle.test.ts
```

此处记录针对性红绿证据。最终完整测试、重新打包和 tarball 消费验证以
本轮候选验收记录为准；旧 tarball 不能代表响应体取消修复后的代码。
