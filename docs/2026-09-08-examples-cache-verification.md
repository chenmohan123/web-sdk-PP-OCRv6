# OCRv6 示例与缓存整改验证

日期：2026-09-08（Asia/Shanghai）。分支：codex/fix-examples-cache，基于 main 5a0923d；未发布 npm、提升版本或执行远程 Git 操作。实施计划见 2026-09-07-examples-cache-plan.md，修改前标准检查由门户保存，原只读审计不改写。

## 根因与修复

- 内置缓存没有使清理前下载失效，旧请求可能迟到回填或覆盖新内容。现在从 manifest 解析前捕获写入代次，当前清理只使匹配 modelId/version 的旧写入失效；同一 JavaScript 环境中同名 IndexedDB 实例共享协调器。清理和写入依调用顺序执行。
- IndexedDB 原先以请求成功代表事务提交，当前删除还拆成枚举与多笔删除。现在等待事务提交，当前清理在单笔游标事务内完成；回滚会拒绝调用，队列随后可恢复。
- memory/IndexedDB 的 estimate 统计存储模型的实际字节，可按 modelId/version 筛选。新增 getModelCacheUsage 和 resolveModelCacheIdentity 用于仓库 Demo；旧 clearModelCache(modelId?, version?)、clearAllModelCache 和旧缓存接口继续兼容。
- Demo 清理同步互斥，取消并等待当前任务、释放会话后删除。清理期间禁用配置/输入/运行和重复清理，自定义 manifest 使用解析后的实际身份；刷新当前及本 SDK 总量，撤下旧结果，失败恢复操作按钮。
- 五个示例固定 npm 已发布 0.1.8。vanilla/react/vite 具备独立 package.json、类型检查、dev/build 和同版本 ORT 资源配置；CDN/微信使用 import map 与真实 CDN 包。默认 ModelScope，可显式选择 Hugging Face；status 改为 schema 允许的 available。
- 独立安装确认 npm 0.1.8 不含 RuntimeOptions.wasmPaths，示例因此通过 ORT 1.27.0 的 env 配置资源并使用主线程。通过 ocr 顺序懒加载 DET/REC；取消/卸载停止 UI 回写，等待初始化结束后由 finally 释放，避免旧版本提前 dispose 漏掉迟到会话。示例没有调用本次新增 API。

## 验证证据

1. 先失败：新增内存/IndexedDB 缓存竞态及容量回归 8 项、Demo 初始化释放 1 项全部复现失败；本地示例缺少 package.json 的检查失败。模拟 0.1.8 初始化资源的卸载测试确认提前 dispose 后资源仍为 1，再修正为等待任务回收。
2. pnpm verify 通过：SDK 22 文件、90 项；Demo 与示例生命周期 5 文件、12 项；仓库/字典 5 项、模型契约 3 项、文档对等 2 项、示例声明 3 项。SDK/Demo 类型检查与 build 均通过。会话释放失败后不复用失效实例的回归同样先失败再修正。
3. Demo Chromium：cache-regression、interaction-regression、runtime-assets 合计 17 项通过；demo.spec 14 项通过，包括 390px 无水平溢出、语言切换、两来源与 Worker/主线程的真实 ORT/WASM 执行。
4. 独立消费者：node examples/tests/consumers.test.mjs 在临时隔离目录执行 npm install 和 npm run build，校验真正安装 0.1.8、HTML 产物及 WASM 魔数；三个示例通过。最终产物位于 C:/Users/chenm/AppData/Local/Temp/ocrv6-consumers-QkhpCS。node examples/tests/browser.test.mjs <临时目录> 验证两来源共 6 次实际 OCR 输出 A，实际后端 wasm。
5. CDN/微信静态页：node examples/tests/browser.test.mjs <临时目录> --cdn 从真实 jsDelivr 加载 0.1.8 和 ORT 1.27.0，两来源共 4 次实际 WASM OCR 通过。
6. 浏览器 OCR 只替换外部模型传输，使用仓库既有有效 ONNX 固定输出模型；页面、公开包、初始化、图片解码、推理及 WASM 均真实执行。这验证接入能力，不验证官方模型准确率。
7. 从门户执行 pnpm sdk:check -- --repo ../web-sdk-PP-OCRv6 --format json：required 18 通过、0 失败、4 远程项跳过，recommended 3 通过，状态 locally-compliant。git diff --check 无空白错误。

## 边界

- 缓存代次协调覆盖同一 JavaScript 模块环境；不同标签页或 SDK 副本没有跨进程广播协议。第三方旧 ModelCache 实现仍兼容；要获得相同并发保证需实现可选 createWriter。SDK 清理只删除存储，Demo 额外释放会话。
- usage 表示模型二进制字节，不含 IndexedDB 内部元数据开销，不代表 navigator.storage 的整个 origin 用量或配额；全部清理仅作用于本 SDK 存储。
- 未验证真实微信设备、Safari/Firefox、GPU 或本轮官方大模型准确率，不新增这些兼容承诺。主代理可协调已有 GPU/官方模型验收。
- Vite 提示现有 ORT 主包超过 500 kB，构建成功；本次不调整无关打包架构。
- 新缓存 API 尚未发布 npm；公开示例保持 0.1.8 可安装执行的范围。
