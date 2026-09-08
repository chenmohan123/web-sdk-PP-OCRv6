# 0.2.0 正式内容定稿验收

核验日期：2026-09-08（Asia/Shanghai）。本地分支为 `codex/prepare-npm-0-2-0`，审阅基线为 `9cc1f8d9da54164a77bcb9ea781cedebddb6139e`。本记录补充 [上一轮候选验收](verification.md)，正式用户说明见 [0.2.0 发布说明](../0.2.0.md)；原发布准备过程归档于 [准备记录](preparation-2026-09-08.md)。

## 定稿内容

- 根双语 README、npm 包内双语 README、API/性能文档、CHANGELOG 和五种示例 README 已移除临时候选措辞。API 与类型明确自 0.2.0 起提供；包内安装命令固定 0.2.0。根 README 以 npm 为公开版本与状态的查询入口，不宣称已上传。
- 三个独立工程的 SDK 依赖、lockfile、CDN/微信 import map 继续固定公开 0.1.8；保留该版本的取消、初始化释放及 WASM 资源配置限制。
- 发布说明独立写明模型来源、许可、默认资产、后端和带日期的验证边界。现有 Release workflow 仍读取 CHANGELOG.md；实际创建 Release 时可使用 `reports/release/0.2.0.md` 作为正文。
- 发布脚本仅改善静态版本校验：允许 package 字段排序、版本单双引号/无引号与行尾注释、Demo 版本文本换行；完整 YAML/schema 校验继续交由门户检查器。格式回归先失败后通过，错误标签以及 manifest、Demo、根包版本不一致均被拒绝；未新增依赖。
- 保留模型、清单和字典响应体取消的运行时修复及回归测试，见 [响应体取消记录](response-cancellation.md)。

## 本轮验证

| 检查 | 结果 |
| --- | --- |
| 门户标准修改前/后 | required 18 通过、0 失败、4 远程 skip；recommended 3 通过、0 失败，仅声明 locally-compliant。见 [before](final-standard-before.json) / [after](final-standard-after.json) |
| `pnpm verify` | 通过：119 项 SDK 测试、14 项 Demo/示例生命周期测试、5 项仓库/字典测试、3 项模型契约、2 项文档对齐、3 项示例契约，以及 SDK 类型与发布静态校验 |
| Demo 类型检查与 SDK/Demo 构建 | 全部通过；Demo 构建保留现存大 chunk 提示 |
| `node --test scripts/verify-release.test.mjs` | 3 项通过；新增格式/错误版本回归先失败后通过 |
| `node scripts/verify-release.mjs v0.2.0` | 通过 |
| `node scripts/verify-package-assets.mjs` 与实际 tarball 检查 | 11 个文件，包含 manifest 和三份字典，无 ONNX；实际包内文件逐个匹配待打包目录 |
| 与已完成浏览器验收的上一轮包比较 | 11 个文件逐一提取比较，仅 README.md 有变化；ESM、Worker、类型、source map、manifest、字典和 package.json 均逐字节一致 |
| 文案搜索与 `git diff --check` | 消费者文档无临时候选措辞；无空白错误 |

上一轮的 33 项 Demo 浏览器测试、3 个独立消费者构建、6 个来源/工程 WASM OCR 组合及主线程/Worker 生命周期验证见 [候选验收](verification.md)。本轮包内执行文件与该包相同，因此未无条件重复模型、GPU 或浏览器任务；这不新增 GPU、移动端或微信宿主兼容承诺。

## 最终本地产物

文件为 `F:/git/00_chenmohan/github/web-sdk-PP-OCRv6/reports/release/0.2.0-candidate/final/web-sdk-pp-ocrv6-0.2.0.tgz`；仅在本地留存，不纳入 Git。压缩后 172,327 字节，展开 503,239 字节。包清单见 [final-pack.json](final-pack.json)，逐文件摘要与旧包差异见 [final-integrity.json](final-integrity.json)。

SHA-512（重新计算并与 npm pack 一致）：

```text
sha512-9TVVgjGABgwmHUtBCixX7lzokIyPH8bcQMsepqR4cCfq978L4s3CEtMbpWgnt5OhqRYrvLTlz5nWhnubb0qMAA==
```

SHA-256：

```text
2c1aebf8dafbbbba3d9ae5b42e55efebe74284672f182b08fabd2ce9c32f9f53
```

## 本地日志与发布边界

原始日志仅保留在本地 `F:/git/00_chenmohan/github/web-sdk-PP-OCRv6/reports/release/0.2.0-candidate/`，不纳入 Git：`final-verify.log`、`final-sdk-build.log`、`final-demo-typecheck.log`、`final-demo-build.log`、`final-release-red.log`、`final-release-green.log`、`final-package-assets.log`。上轮同目录的原始日志和 tarball 同样只在本地留存；提交仅选择审阅所需文本报告、源码、文档及测试。

本地定稿未创建提交、标签、npm 发布或 GitHub Release，也未修改远程治理和认证。2026-09-08 12:06 北京时间的 registry 快照仍为公开 0.1.8，见 [registry.json](registry.json)；正式发布前应刷新 npm、CI、GOV-002 标签保护与 Trusted Publisher 证据。发布 npm、标签与治理变更等待主任务的明确授权步骤。物理 runner 仅允许使用 `F:/github-runner`，本轮未启动 runner。
