# OCRv6 耗时与实际后端整改验收

- 日期：2026-09-08（Asia/Shanghai）。
- 分层：单 SDK runtime、当前模型 Demo 与双语性能/API 文档。
- 基线：`3ee2050c23461826214301613a187560aaf07cf9`；工作分支：`codex/fix-runtime-performance`。
- 本记录包含合并前源码及验证；本轮按授权分别 PR、合并 main 和发布 Pages，提交对应关系由门户最终报告保存。
- 版本保持 `0.1.8`。新增可选 API 已标注为源码能力，尚未发布；独立示例公开版本未改动。

## 已复现与修复

| 项目 | 根因与失败证据 | 修复与回归 |
| --- | --- | --- |
| OCR-03 热运行重复加载 | detector 第二轮仍返回下载/缓存/校验/session = 1/2/3/4；recognizer 同样保留首次分项 | 当前分项按初始化发起者归属，热运行四项归零；`initialization` 单列历史分项。见 `packages/sdk/tests/detector.test.ts`、`recognizer.test.ts`、`factory-performance.test.ts` |
| OCR-03 显式加载与首次懒加载边界 | 工厂在 engine 计时前完成初始化，原结果 total 未覆盖公开调用的初始化等待 | 公开运行方法测量完整调用，显式 await load 后首轮为 warm；首次懒加载为 cold。新实例缓存命中仍 cold，source 为 cache |
| 初始化中途加入 | 可控时钟复现 total = 10 ms，却将此前已开始的 110 ms session 计入本次；main/Worker 两条失败 | 中途加入者仅将剩余等待计入 total，加载分项归初始发起者，110 ms 留在历史 initialization 中 |
| OCR-04 空检测重复累计 | 没有调用 REC，inference 从 7 变成 14、preprocess 从 6 变成 12；入口额外 25 ms 解码未计入 | 空识别九项为零，recognitionMs 为零；入口 decode 单独累计，测试期望 decode = 25 + 5 = 30 ms |
| OCR-05 实际后端误报 | 公开工厂模拟 WebGPU 创建失败后实际成功 WASM，OCR 总结果仍报告 WebGPU | 从已执行 DET/REC 结果产生 runtime；混合执行保留 componentBackends。顶层 actualBackend 为 DET，UI 展示两个实际组件 |
| Demo 冷启动误用分项相加 | 冷启动仅加 download 与 session，漏 cache/integrity 且不考虑 DET/REC 并行 | session manager 实测 load 墙钟等待，复用为零；Demo 显示本次端到端、初始化等待、SDK 当前运行以及折叠的历史分项 |

新增可选 `InitializationTiming`、实例 `initialization`、结果 `timings.initialization`、`loadState` 与 `runtime.componentBackends` 不修改旧必填字段类型。实际边界见 [中文性能文档](../zh-CN/performance.md) 和 [英文性能文档](../en/performance.md)。

## 红绿证据

1. 修改生产代码前，运行 detector、recognizer、pipeline-performance、factory-performance：4 文件，10 失败、2 通过。失败分别命中热运行残留、空图重复计时和后端误报。
2. 增加显式预加载语义断言后，detector 与 factory-performance：13 失败、1 通过。
3. Demo session manager 的可控时钟测试：期望 50 ms loadMs，原结果没有该字段；1 失败、5 通过。
4. 初始化中途加入边界：main/Worker 两条失败，原 sessionMs = 110 ms，本次 totalMs = 10 ms。
5. 最终定向 SDK 命令：`node ../../node_modules/vitest/vitest.mjs run tests/factory-performance.test.ts tests/detector.test.ts tests/recognizer.test.ts tests/pipeline-performance.test.ts --no-cache`，在 `packages/sdk` 执行，4 文件、22 测试全部通过。

## 最终验证

环境：Windows、Node.js `v24.16.0`、pnpm `11.21.0`、Playwright `1.62.1` 所带 Chromium、ONNX Runtime Web `1.27.0`。所有 pnpm 命令仅为当前进程设置 `pnpm_config_verify_deps_before_run=false`。

| 命令 | 结果 |
| --- | --- |
| `pnpm verify` | 退出 0；SDK 24 文件、115 测试；Demo/示例 6 文件、14 测试；仓库/字典、模型、文档、示例及 release 契约检查均通过 |
| `pnpm build` | 退出 0；SDK ESM、Worker、声明文件构建成功 |
| `pnpm --filter @ppocrv6/demo typecheck` | 退出 0 |
| `pnpm --filter @ppocrv6/demo build` | 退出 0；仅既有大于 500 kB 的 bundle 提示 |
| `pnpm --filter @ppocrv6/demo test -- --workers=1` | 退出 0；33 测试通过，40.2 秒 |
| 门户 `pnpm sdk:check -- --repo ../web-sdk-PP-OCRv6 --format json --out ../web-sdk-PP-OCRv6/docs/validation/runtime-performance-standard-2026-09-08.json` | 退出 0；required 18 通过、0 失败、4 跳过，recommended 3 通过 |
| `git diff --check` | 退出 0；只有 Windows 换行转换提示 |

浏览器测试使用受控 ONNX 小模型替换外部传输，真实执行页面、SDK、Worker 和 WASM；覆盖检测、识别、完整 OCR 的主线程与 Worker，完整 OCR 两种来源，首次初始化与后续复用，且验证重复运行没有新模型请求。另有图片/缓存/取消回归、390px 无横向溢出、中英切换。可控执行器回归覆盖自动 WebGPU 创建失败后回退 WASM，以及 DET/REC 不同后端的结果；这不是实际 GPU 验证。

标准检查前后的原始快照分别为 [修改前](runtime-performance-before-2026-09-08.json) 和 [修改后](runtime-performance-standard-2026-09-08.json)。检查器结果只证明本地规则匹配；远程规则仍跳过。

## 边界

- 主任务补充 Windows Chromium 151 / NVIDIA Blackwell 非软件回退适配器 / ORT 1.27.0 验证：官方 small DET/REC，main 与 Worker，懒加载、缓存预加载、同会话重复识别全部通过；八次均识别 146 行，实际组件均为 WebGPU，热运行加载四项均为零。模型传输使用 SHA-256 匹配的本机官方字节，该证据不代表 ModelScope 网络可用性或普遍性能基准。原始记录在门户 `reports/sdk-standard/2026-09-08-runtime-performance/ocr-sdk-gpu.json`。
- 独立审查补充旧自定义组件兼容性回归：新增 7 项，修复前 3 项失败，修复后全部通过。缺少可选 `loadState` 时保留未知，空 REC 作为未执行处理。
- 没有扩大修改到缓存/取消行为，也没有改动其他 SDK 或门户标准。
- 初始化历史分项为组件累计工作量，不是端到端墙钟之和；外部自定义组件未提供新的可选元数据时，不能推断其初始化来源。
- 初次沙箱读写既有文件、Playwright 临时缓存遇到 ACL/EPERM；用户明确授权后使用宿主机权限执行同一操作，没有删除缓存目录或修改全局环境。
