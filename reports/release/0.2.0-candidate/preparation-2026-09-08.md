# PP-OCRv6 0.2.0 本地发布候选准备快照

此文保留正式文案定稿前的准备过程；最终内容与产物见 [定稿验收](finalization-2026-09-08.md)。

准备日期：2026-09-08（Asia/Shanghai）。基于 `main` 的 `9cc1f8d9da54164a77bcb9ea781cedebddb6139e`，分支 `codex/prepare-npm-0-2-0`。本记录参考门户 `standards/v1/templates/release-checklist.md`；当前没有创建提交、标签、npm 发布或 GitHub Release。2026-09-08 的 registry 核验仍为 0.1.8，0.2.0 仅作为本地候选包使用。

## 发布说明草稿

0.2.0 在已有 API 之上增加模型缓存容量与身份查询、Worker/主线程资源路径配置、自定义模型预设和初始化观测字段，因此采用 minor 版本。模型版本继续为 PP-OCRv6 1.0.0。

- 新增 `getModelCacheUsage(modelId?, version?)`、`resolveModelCacheIdentity(selection?, signal?)` 和可选 `CacheWriter/createWriter`；清理阻止同模块中在途下载迟到写回，IndexedDB 成功以事务提交为准。
- `RuntimeOptions.wasmPaths` 支持绝对目录或 `{ mjs, wasm }`，配置传递到 Worker 与主线程；自定义模型支持 `preset`。
- 初始化期间释放会取消模型和字典下载并等待初始化收尾；主线程取消立即报告 `ABORTED`，底层在途计算由后续调用和释放等待。修复默认 manifest URL。
- 候选 tarball 生命周期验证发现并修复模型、清单和字典响应体读取取消的错误码问题：主动取消统一保留 `ABORTED`，真正的下载与清单错误保持原分类。回归证据见 [响应体取消记录](response-cancellation.md)。
- `initialization`、`timings.initialization`、`timings.loadState` 和 `runtime.componentBackends` 保留历史初始化、当前调用冷热状态和实际执行组件后端。热运行不再重复累加加载，空检测不执行 REC，入口解码纳入 OCR 耗时。
- Demo 展示当前模型与整个 SDK 的缓存字节数，清理时取消任务并释放会话，分开显示新会话、复用会话、初始化等待及本次端到端耗时。

模型来源为 PaddlePaddle 官方 PP-OCRv6 medium/small/tiny 检测与识别 ONNX，共六个 FP32 文件。来源、不可变 Hugging Face revision、大小和 SHA-256 见 [manifest](../../../models/pp-ocrv6/manifest.json) 与 [model-source](../../../models/pp-ocrv6/model-source.json)。SDK 和模型采用 Apache-2.0，第三方许可证见 [THIRD_PARTY_NOTICES](../../../THIRD_PARTY_NOTICES.md)。默认资产为 `small-det`（9,880,512 字节）与 `small-rec`（21,159,378 字节）。浏览器默认从固定 revision 的 Hugging Face URL 下载并验证；GitHub Release 是版本化归档来源，本候选不会创建新归档。

npm 包包含 ESM、Worker、类型、模型 manifest、三份识别字典和双语 README，不含 ONNX。ONNX Runtime Web 固定 1.27.0；默认 CPU WASM，WebGPU 可显式请求；只有 `auto` 且 `allowFallback: true` 才允许回退。支持 Worker 和主线程，实际后端见结果字段。

当前浏览器验证仅覆盖本地 Windows 的 Chromium 与 WASM；小型 ONNX fixture 用于验证执行路径，不能代替所有官方模型和设备的识别质量验证。本轮不新增物理 GPU、移动端或微信宿主兼容承诺；既有边界和带日期证据见 [兼容性](../../../docs/zh-CN/compatibility.md) 与 [运行时验证](../../../docs/validation/runtime-performance-2026-09-08.md)。不支持微信原生小程序 runtime。跨标签页缓存失效广播尚未实现；OCR 顶层 `actualBackend` 代表 DET，混合后端需读取 `componentBackends`。

## 本地候选验证入口

下列命令均为本地检查、构建、打包或独立消费者验证，不会执行 publish。PowerShell 如被依赖自动验证阻塞，可仅为当前进程设置 `$env:pnpm_config_verify_deps_before_run='false'`。

```powershell
pnpm verify
pnpm --filter @ppocrv6/demo typecheck
pnpm --filter web-sdk-pp-ocrv6 build
pnpm --filter @ppocrv6/demo build
node scripts/verify-release.mjs v0.2.0
node --test scripts/verify-release.test.mjs
node scripts/verify-pp-ocrv6-models.mjs
node scripts/verify-package-assets.mjs
pnpm --filter @ppocrv6/demo test
npm pack ./packages/sdk --pack-destination ./reports/release/0.2.0-candidate --ignore-scripts
node examples/tests/consumers.test.mjs reports/release/0.2.0-candidate/web-sdk-pp-ocrv6-0.2.0.tgz
node examples/tests/browser.test.mjs <上条命令输出的临时目录> --candidate
```

不带 tarball 参数的消费者入口继续安装公开 0.1.8。带参数时只修改临时副本的依赖，保留仓库三个工程的 package.json、锁文件与五个公开示例的固定版本；额外入口从 tarball 公开 API 验证资源路径、缓存、计时、取消和初始化释放。浏览器使用小型真实 ONNX fixture，只替换模型传输，实际执行打包后的 SDK、ORT 与 WASM。

## 正式发布前与发布后

- 本地检查结果、候选完整性和环境信息记录于 [候选验收记录](verification.md)。修改前后门户标准检查报告保留在同目录。
- 正式发布前需补齐远程 `GOV-002`：当前只读审计未发现禁止 `v*` 标签更新/删除的活动 Ruleset；还需刷新 main 必需 CI、Ruleset 与 npm Trusted Publisher 对仓库、`release.yml`、`npm` environment 的匹配证据。本地通过仅表示 `locally-compliant`。
- 获得后续明确授权后才可创建不可变 `v0.2.0` 标签、发布 npm 或 GitHub Release。当前 release workflow 会同时发布 npm 和上传模型归档，不能作为仅验证的入口。
- 0.2.0 正式上传后先独立核验 registry 版本、tarball SHA-512、provenance 与标签提交，再将 `examples/{react,vanilla,vite}/package.json` 和对应 lockfile 的 SDK 条目改为 0.2.0；只更新 SDK 条目，不改 `confbox@0.1.8` 等无关依赖。
- 同步 CDN/微信 import map、五种 README、版本断言和 runner 的 0.1.8 限制说明。初始化等待包装可在实际新版生命周期验证后调整，Worker 还需同源部署和资源路径验证。最后从公开 registry 重新运行三个独立工程构建、六种来源/工程组合的实际 WASM OCR，以及两个 CDN 页的四种来源组合；通过后再撤下候选措辞。
