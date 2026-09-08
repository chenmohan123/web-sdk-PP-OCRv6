# 0.2.0 候选验收记录

此文为正式文案定稿前的 2026-09-08 验收快照；当前最终包与本轮复核见 [正式内容定稿验收](finalization-2026-09-08.md)。原始日志与 tarball 仅在本地同目录留存，不纳入 Git。

核验日期：2026-09-08（Asia/Shanghai）。本地分支 `codex/prepare-npm-0-2-0`，基于 `9cc1f8d9da54164a77bcb9ea781cedebddb6139e`，改动尚未提交。包版本为 0.2.0，模型版本仍为 PP-OCRv6 1.0.0；2026-09-08 12:06 北京时间只读刷新 registry，公开 latest 仍为 0.1.8 且 0.2.0 不存在，见 [registry 记录](registry.json)。

## 最终结果

| 检查 | 结果与证据 |
| --- | --- |
| 标准检查修改前/后 | 均为 required 18 通过、0 失败、4 远程 skip；recommended 3 通过、0 失败，仅声明 locally-compliant。见 [before](standard-before.json) / [after](standard-after.json) |
| `pnpm verify` | 通过：119 项 SDK 测试、14 项 Demo/示例生命周期测试、5 项仓库/字典测试、3 项模型契约、2 项文档对齐、3 项示例契约；包含 SDK 类型检查与发布静态校验。见 日志：`verify.log`（本地留存） |
| Demo 类型检查 | `pnpm --filter @ppocrv6/demo typecheck` 通过，见 日志：`demo-typecheck.log`（本地留存） |
| SDK / Demo 构建 | 均通过。SDK 产出 ESM、Worker、声明及运行时资产；Demo 有现存的大 chunk 提示。见 SDK：`sdk-build.log`（本地留存） / Demo：`demo-build.log`（本地留存） |
| 发布版本检查 | `node scripts/verify-release.mjs v0.2.0` 通过；新增根版本、manifest、Demo 显示与当前 CHANGELOG 条目一致性校验。错误标签 v0.1.8 被拒绝，见 [完整性记录](integrity.json)；现有发布契约测试 2 项通过 |
| 官方模型实物 | 六个本地 ONNX 的大小、SHA-256、opset、参数量、输入输出与字典数量全部通过，并逐个创建 WASM 会话。未改写模型资产，见 [报告](models.json) |
| 包资产 | 11 文件，含 manifest 和三份识别字典，无 ONNX，见 日志：`package-assets.log`（本地留存） / [pack 清单](pack.json) |
| Demo 浏览器 | 最终修复后 33 项 Playwright 测试通过，包含 WASM 主线程/Worker、缓存清理、初始化与 UI 回归，见 日志：`demo-browser.log`（本地留存） |
| 独立候选消费者 | vanilla、react、vite 在临时目录安装实际 0.2.0 tarball 后均通过类型检查和构建，见 日志：`consumers.log`（本地留存） |
| 候选包浏览器 | 三工程 × ModelScope/Hugging Face 共 6 次实际 WASM OCR 通过；另对主线程和 Worker 各验证 `wasmPaths`、实际组件后端、热运行加载分项为零、历史初始化、缓存身份与容量、预取消、幂等释放、初始化下载期间释放及无迟到缓存写入。见 日志：`consumer-browser.log`（本地留存） |

浏览器实测环境：Windows `10.0.26200`、Intel Core i5-10400F、Chromium `151.0.7922.34`、ONNX Runtime Web `1.27.0`、CPU WASM；工具为 Node `24.16.0`、pnpm `11.21.0`、npm `11.13.0`。浏览器只替换模型网络传输为小型真实 ONNX fixture，SDK、ORT 和 WASM 均来自实际候选安装。该结果不扩展为 GPU、移动端、微信宿主或其他设备的兼容承诺。仓库未提供独立 lint 命令。

## 候选产物

候选文件：web-sdk-pp-ocrv6-0.2.0.tgz：`web-sdk-pp-ocrv6-0.2.0.tgz`（本地留存），压缩后 172,620 字节，展开 503,787 字节。重新计算的 SHA-512 与 `npm pack --json` 一致：

```text
sha512-YZMOv0i8jsHMznlMiAK7EPe1iD4Jg3wuu+0R4GHT6Koc25+CebB61O8/wZn07s7/vxyEjei0a2VcXKOG5cLHoA==
```

最终独立安装目录为 `C:/Users/chenm/AppData/Local/Temp/ocrv6-consumers-jWckxF`。三个消费者安装的 ESM、Worker 和类型文件逐字节匹配最终 SDK 构建，见 [integrity.json](integrity.json)。临时目录用于复现，不是发布目录。

候选验证实际发现了响应体取消错误码缺陷；模型读取回归先失败后通过，相关清单和字典路径也已补齐，见 [详细记录](response-cancellation.md)、模型红灯：`download-red.log`（本地留存） 与 模型绿灯：`download-green.log`（本地留存）。最终测试和 tarball 均包含这些修复。

## 发布边界

根包、SDK 包、manifest 与 Demo 显示已统一为 0.2.0；根/npm 双语 README、API/性能文档、CHANGELOG 和五种示例说明已同步候选状态，英文 API 中的中文段落已修正。公开 CDN、独立工程依赖、lockfile 及其 0.1.8 限制包装继续对应 registry 版本；候选入口仅修改临时消费者。

本轮未创建提交、推送分支、创建标签、修改 Ruleset、发布 npm、创建 GitHub Release、触发发布 workflow 或启动物理 GPU runner。正式发布前仍需补齐 OCR 的 GOV-002 标签保护，并刷新 CI、治理与 npm Trusted Publisher 证据；切换公开示例的具体步骤见 [准备记录](preparation-2026-09-08.md)。自动审批曾发生 502 和超时，重试已成功，本轮无因此遗留的验证阻塞。
