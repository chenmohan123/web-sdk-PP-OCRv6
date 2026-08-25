# PP-OCRv6 进度状态与耗时展示 Implementation Plan（实施计划）

> **供智能体执行：** 必须使用 `superpowers:executing-plans` 按任务逐项实施；每个步骤使用复选框跟踪。

**目标：** 为 SDK 增加可观察的模型获取、校验、会话和推理进度，并将 Demo 顶部状态栏改成左侧紧凑状态块，同时拆分右侧下载与加载耗时。

**架构：** SDK 通过公开 `OCRProgress` 事件描述阶段，底层下载器、模型管理器和 ONNX 执行器各自只上报所属阶段。新增内部进度模块负责吞掉用户回调异常，并在完整 OCR 同时加载 DET/REC 时按实际网络下载字节加权聚合；Demo 只把事件映射为已确认的用户可见状态。

**技术栈：** TypeScript 5.9、ONNX Runtime Web 1.27、React 19、Vitest 3、Playwright 1.62、pnpm workspace。

---

## 文件职责

- 新增 `packages/sdk/src/progress.ts`：安全派发公开事件，跟踪 DET/REC 的缓存或网络来源，聚合实际下载字节。
- 修改 `packages/sdk/src/types.ts`：定义公开进度类型和 `RuntimeOptions.onProgress`。
- 修改 `packages/sdk/src/model/download.ts`：流式读取响应并报告真实字节进度，保留非流式回退。
- 修改 `packages/sdk/src/model/model-manager.ts`：报告缓存与完整性阶段，并把下载事件向上传递。
- 修改 `packages/sdk/src/runtime/{worker-bridge,executor}.ts` 与 `packages/sdk/src/inference.worker.ts`：贯通主线程和 Worker 的会话/推理事件。
- 修改 `packages/sdk/src/factory.ts`：标注组件、映射 runtime 阶段，并为完整 OCR 创建共享加权报告器。
- 修改 `apps/demo/src/App.tsx`、中英文文案和 `styles.css`：迁移状态 UI，增加下载进度条、错误详情和分项耗时。
- 修改 SDK 单元测试、Demo Playwright 测试、README/API 文档和 CHANGELOG：锁定契约并说明使用方式。

### 任务 1：公开进度类型与安全派发

**文件：**

- 修改：`packages/sdk/src/types.ts`
- 新增：`packages/sdk/src/progress.ts`
- 修改：`packages/sdk/tests/public-contract.test.ts`
- 新增：`packages/sdk/tests/progress.test.ts`

- [ ] **步骤 1：先写失败的公开类型与聚合器测试**

在 `public-contract.test.ts` 构造带回调的 `RuntimeOptions`，在 `progress.test.ts` 覆盖回调抛错不外溢、单模型下载百分比、DET/REC 实际网络字节加权、缓存组件不进入下载分母：

```ts
const events: OCRProgress[] = [];
const options: RuntimeOptions = { onProgress: (event) => events.push(event) };
expect(options.onProgress).toBeTypeOf("function");

const reporter = createProgressReporter(options.onProgress, ["det", "rec"]);
reporter.register("det", 25);
reporter.register("rec", 75);
reporter.emit("det", { phase: "cache", progress: 1 });
reporter.emit("det", { phase: "integrity", progress: 0 });
reporter.emit("rec", { phase: "cache", progress: 1 });
reporter.emit("rec", { phase: "download", progress: 0.5, loadedBytes: 37, totalBytes: 75 });
expect(events.at(-1)).toMatchObject({ phase: "download", progress: 37 / 75, loadedBytes: 37, totalBytes: 75 });
```

- [ ] **步骤 2：运行测试并确认因类型和模块缺失而失败**

运行：

```powershell
pnpm --filter web-sdk-pp-ocrv6 test -- public-contract.test.ts progress.test.ts
```

预期：FAIL，提示 `OCRProgress`、`RuntimeOptions.onProgress` 或 `progress.ts` 不存在。

- [ ] **步骤 3：实现公开类型和内部报告器**

在 `types.ts` 增加六个阶段和回调：

```ts
export type OCRProgressPhase = "manifest" | "cache" | "download" | "integrity" | "load" | "inference";
export type OCRProgressComponent = "det" | "rec";
export interface OCRProgress {
  readonly phase: OCRProgressPhase;
  readonly component?: OCRProgressComponent;
  readonly progress?: number;
  readonly loadedBytes?: number;
  readonly totalBytes?: number;
}
export interface RuntimeOptions {
  // 保留现有字段
  readonly onProgress?: (event: OCRProgress) => void;
}
```

`progress.ts` 提供 `safeEmitProgress` 和 `createProgressReporter`。报告器等待所有预期组件完成缓存判定：首次 `download` 表示网络来源，未出现下载而进入 `integrity` 表示缓存来源；聚合事件仅以网络组件总字节为分母，`progress` 限制在 `[0, 1]`。非下载事件附加 `component` 后立即安全派发。

- [ ] **步骤 4：运行测试并确认通过**

运行同步骤 2；预期相关测试 PASS。

- [ ] **步骤 5：提交该任务**

```powershell
git add packages/sdk/src/types.ts packages/sdk/src/progress.ts packages/sdk/tests/public-contract.test.ts packages/sdk/tests/progress.test.ts
git commit -m "feat: 增加 OCR 进度事件契约"
```

### 任务 2：流式模型下载、缓存与完整性事件

**文件：**

- 修改：`packages/sdk/src/model/download.ts`
- 修改：`packages/sdk/src/model/model-manager.ts`
- 新增：`packages/sdk/tests/download.test.ts`
- 修改：`packages/sdk/tests/model-manager.test.ts`

- [ ] **步骤 1：先写流式与降级失败测试**

构造两段 `ReadableStream<Uint8Array>`，验证开始、字节增量和完成事件；再用 `body: null` 的响应替身验证 `arrayBuffer()` 回退：

```ts
expect(progress).toEqual([
  expect.objectContaining({ phase: "download", progress: 0, loadedBytes: 0, totalBytes: 4 }),
  expect.objectContaining({ phase: "download", progress: 0.5, loadedBytes: 2, totalBytes: 4 }),
  expect.objectContaining({ phase: "download", progress: 1, loadedBytes: 4, totalBytes: 4 }),
]);
```

在 `model-manager.test.ts` 分别断言缓存命中顺序 `cache 0 -> cache 1 -> integrity 0 -> integrity 1`，网络路径包含 `download`，并验证抛异常的回调不影响返回结果。

- [ ] **步骤 2：运行下载与模型管理器测试并确认失败**

```powershell
pnpm --filter web-sdk-pp-ocrv6 test -- download.test.ts model-manager.test.ts
```

预期：FAIL，当前下载器只调用 `arrayBuffer()`，模型管理器也没有进度选项。

- [ ] **步骤 3：实现流式读取与阶段事件**

为 `downloadModel` 选项增加 `onProgress`，使用 `request.bytes` 作为可信总字节：

```ts
const reader = response.body?.getReader();
if (reader) {
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  safeEmitProgress(onProgress, { phase: "download", progress: 0, loadedBytes, totalBytes: request.bytes });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.byteLength;
    safeEmitProgress(onProgress, {
      phase: "download",
      progress: Math.min(loadedBytes / request.bytes, 1),
      loadedBytes,
      totalBytes: request.bytes,
    });
  }
  bytes = concatenateChunks(chunks, loadedBytes);
} else {
  safeEmitProgress(onProgress, { phase: "download" });
  bytes = new Uint8Array(await response.arrayBuffer());
}
```

下载完成后保证发出 `progress: 1`，校验前后发出 `integrity` 边界。读取流失败仍包装为 `MODEL_DOWNLOAD_FAILED`，取消仍为 `ABORTED`。

为 `createModelManager` 选项增加 `onProgress`。缓存读取前后发 `cache`；缓存命中校验发 `integrity`；网络路径把同一回调传入下载器。保持 `ModelManager.load(request, signal?)` 签名不变。

- [ ] **步骤 4：运行相关测试并确认通过**

运行同步骤 2；预期全部 PASS。

- [ ] **步骤 5：提交该任务**

```powershell
git add packages/sdk/src/model packages/sdk/tests/download.test.ts packages/sdk/tests/model-manager.test.ts
git commit -m "feat: 报告模型下载和校验进度"
```

### 任务 3：贯通主线程与 Worker 的加载和推理事件

**文件：**

- 修改：`packages/sdk/src/runtime/ort-session.ts`
- 修改：`packages/sdk/src/runtime/worker-bridge.ts`
- 修改：`packages/sdk/src/runtime/executor.ts`
- 修改：`packages/sdk/src/inference.worker.ts`
- 修改：`packages/sdk/tests/ort-session.test.ts`
- 修改：`packages/sdk/tests/worker-bridge.test.ts`
- 新增：`packages/sdk/tests/executor-progress.test.ts`

- [ ] **步骤 1：先写 Worker 与执行器进度失败测试**

在 Worker Bridge 测试中，在请求完成前发送同一 `requestId` 的 progress 消息：

```ts
const progress = vi.fn();
const bridge = createWorkerBridge(worker, { onProgress: progress });
const load = bridge.load(new ArrayBuffer(2));
worker.respond({ type: "progress", requestId, phase: "session", progress: 0 });
expect(progress).toHaveBeenCalledWith({ phase: "session", progress: 0 });
```

执行器测试分别注入 fake Worker 和 fake ORT，断言 `session` 与 `inference` 的 `0/1` 都能到达 `createInferenceExecutor({ onProgress })`。ORT 测试增加“用户回调抛错不会使会话创建或推理失败”。

- [ ] **步骤 2：运行 runtime 测试并确认失败**

```powershell
pnpm --filter web-sdk-pp-ocrv6 test -- ort-session.test.ts worker-bridge.test.ts executor-progress.test.ts
```

预期：FAIL，Worker Bridge 当前丢弃 progress，执行器没有 `onProgress`。

- [ ] **步骤 3：实现端到端转发**

`createWorkerBridge(worker, { onProgress }?)` 收到 progress 时安全调用回调但保留 pending 请求；`createInferenceExecutor` 增加：

```ts
readonly onProgress?: (progress: OrtSessionProgress) => void;
```

Worker 与 main 两个分支都把它传到桥接层或 `createOrtSession`。`createOrtSession` 的四个回调点统一走安全派发。

修正 Worker 的 requestId 归属：使用当前请求 ID 发送进度，加载时绑定 load 请求，运行时绑定 run 请求，finally 清理，避免会话创建闭包把后续 inference 事件错误发给旧 load 请求。

- [ ] **步骤 4：运行 runtime 测试并确认通过**

运行同步骤 2；预期全部 PASS。

- [ ] **步骤 5：提交该任务**

```powershell
git add packages/sdk/src/runtime packages/sdk/src/inference.worker.ts packages/sdk/tests/ort-session.test.ts packages/sdk/tests/worker-bridge.test.ts packages/sdk/tests/executor-progress.test.ts
git commit -m "feat: 贯通 Worker 推理进度事件"
```

### 任务 4：在公开工厂聚合 DET/REC 进度

**文件：**

- 修改：`packages/sdk/src/factory.ts`
- 新增：`packages/sdk/tests/factory-progress.test.ts`

- [ ] **步骤 1：先写公开工厂失败测试**

注入可控的 manifest、模型响应和 fake executor 依赖，验证：

- detector/recognizer 事件带正确 `component`。
- `manifest`、`cache`、`download`、`integrity`、`load` 顺序可观察。
- 完整 OCR 的 DET 缓存命中、REC 网络下载时，下载分母只包含 REC 字节。
- 完整 OCR 的 DET/REC 都走网络时，最终下载事件是 `{ progress: 1, loadedBytes: detBytes + recBytes, totalBytes: detBytes + recBytes }`。

若当前工厂无法注入依赖，将网络获取和引擎创建依赖收敛到文件内的窄接口，不修改公开 API。

- [ ] **步骤 2：运行工厂测试并确认失败**

```powershell
pnpm --filter web-sdk-pp-ocrv6 test -- factory-progress.test.ts
```

预期：FAIL，`RuntimeOptions.onProgress` 尚未传入 manager/executor，也没有组件聚合。

- [ ] **步骤 3：重构准备阶段并连接报告器**

把现有 `prepare` 拆为“解析 asset”和“根据已解析 asset 加载模型/创建 executor”两个内部步骤。单 detector/recognizer 使用一个预期组件的报告器；完整 OCR 先并行解析两个 asset，再用其 `bytes` 注册共享报告器，然后并行准备两个 engine，最后建立懒加载 `OCRPipeline`。

阶段映射：

```ts
onProgress: (event) => reporter.emit(role, event)
// ORT 内部 session -> 公开 load
onProgress: ({ phase, progress }) => reporter.emit(role, {
  phase: phase === "session" ? "load" : "inference",
  progress,
})
```

manifest 获取前后分别发边界事件；所有用户回调均通过报告器安全派发。保留后端候选回退、字典加载、已有 timings 和幂等 dispose 行为。

- [ ] **步骤 4：运行工厂与公开契约测试并确认通过**

```powershell
pnpm --filter web-sdk-pp-ocrv6 test -- factory-progress.test.ts public-contract.test.ts pipeline.test.ts
```

预期全部 PASS。

- [ ] **步骤 5：提交该任务**

```powershell
git add packages/sdk/src/factory.ts packages/sdk/tests/factory-progress.test.ts
git commit -m "feat: 聚合 OCR 双模型加载进度"
```

### 任务 5：迁移 Demo 状态并拆分耗时

**文件：**

- 修改：`apps/demo/src/App.tsx`
- 修改：`apps/demo/src/i18n/zh-CN.ts`
- 修改：`apps/demo/src/i18n/en.ts`
- 修改：`apps/demo/src/styles.css`
- 修改：`apps/demo/tests/demo.spec.ts`

- [ ] **步骤 1：先写 Demo 失败测试**

扩展 fixture 流程，在开始识别后依次停留于下载、加载、运行阶段。Playwright 断言：

```ts
await page.getByRole("button", { name: "开始识别" }).click();
await expect(page.getByTestId("status")).toContainText("模型下载中 25%");
await expect(page.getByTestId("download-progress")).toHaveAttribute("aria-valuenow", "25");
await expect(page.getByTestId("status")).toContainText("模型加载中");
await expect(page.getByTestId("status")).toContainText("识别中");
await expect(page.getByTestId("status")).toContainText("识别完成");
await expect(page.locator(".statusbar")).toHaveCount(0);
```

识别完成后断言右侧存在“模型下载”“模型加载”“预处理”“推理”“后处理”。增加 fixture 错误参数，断言 `MODEL_DOWNLOAD_FAILED · Failed to fetch` 完整显示；390px 下继续无横向溢出。

- [ ] **步骤 2：运行 Demo 测试并确认失败**

```powershell
pnpm --filter @ppocrv6/demo test -- --grep "状态|progress|耗时|错误"
```

若中文 grep 不匹配现有英文测试名，则运行 `pnpm --filter @ppocrv6/demo test`。预期新断言 FAIL。

- [ ] **步骤 3：实现紧凑状态块与进度映射**

状态联合类型增加 `downloading`。`createOCR` 传入 `onProgress`：

```ts
onProgress(event) {
  if (event.phase === "download") {
    setStatus("downloading");
    setDownloadProgress(event.progress);
  } else if (event.phase === "inference") {
    setStatus("running");
  } else {
    setStatus("loading");
  }
}
```

删除 header 与 workspace 之间的 `.statusbar`，在 `.run-actions` 下新增 `data-testid="status"` 的 `.run-status`。下载百分比四舍五入显示；存在数值时渲染原生 ARIA progressbar，错误信息独占下一行并允许断词。取消和重置清空下载百分比。

缓存操作反馈移到右侧 `.cache-actions` 之后，使用 `aria-live="polite"`。`timingRows` 改为总耗时、模型下载 `modelDownloadMs`、模型加载 `sessionMs`、预处理、推理、后处理；缓存读取和 SHA-256 以较弱辅助行显示。fixture 依次模拟 `25% download -> loading -> running -> success`，错误 fixture 返回稳定错误码。

CSS 删除 `.statusbar`，工作区最小高度改为减去 68px 顶栏；新增紧凑状态、4px 进度轨道、错误与缓存反馈样式。桌面和 390px 断点都不得使按钮或长错误消息横向溢出。

- [ ] **步骤 4：运行 Demo 类型检查和测试并确认通过**

```powershell
pnpm --filter @ppocrv6/demo typecheck
pnpm --filter @ppocrv6/demo test
```

预期全部 PASS。

- [ ] **步骤 5：提交该任务**

```powershell
git add apps/demo/src apps/demo/tests/demo.spec.ts
git commit -m "feat: 细化 Demo 运行状态和耗时"
```

### 任务 6：更新文档、构建并完成全量验证

**文件：**

- 修改：`README.md`
- 修改：`README.en.md`
- 修改：`docs/zh-CN/api.md`
- 修改：`docs/en/api.md`
- 修改：`docs/zh-CN/performance.md`
- 修改：`docs/en/performance.md`
- 修改：`CHANGELOG.md`

- [ ] **步骤 1：先更新文档契约测试或校验预期**

在现有文档等价校验覆盖的中英文文件中同时加入 `onProgress`、六个阶段、流式百分比降级和耗时字段说明。README 快速开始示例加入：

```ts
const ocr = createOCR({
  model: { det: "small", rec: "small" },
  backend: "wasm",
  execution: "worker",
  onProgress(event) {
    if (event.phase === "download" && event.progress !== undefined) {
      console.log(`模型下载 ${Math.round(event.progress * 100)}%`);
    }
  },
});
await ocr.load();
const result = await ocr.ocr(file);
```

CHANGELOG 在 `未发布` 小节记录 SDK 进度回调、Demo 状态迁移与耗时拆分，不提前修改版本号。

- [ ] **步骤 2：运行文档和 SDK 全量验证**

```powershell
pnpm verify
pnpm --filter web-sdk-pp-ocrv6 typecheck
pnpm --filter web-sdk-pp-ocrv6 test
pnpm --filter web-sdk-pp-ocrv6 build
pnpm --filter @ppocrv6/demo typecheck
pnpm --filter @ppocrv6/demo build
pnpm --filter @ppocrv6/demo test
```

预期全部退出码为 0。

- [ ] **步骤 3：运行门户标准检查**

在 `F:\git\00_chenmohan\github\chenmohan123.github.io` 运行：

```powershell
pnpm sdk:check -- --repo F:\git\00_chenmohan\github\web-sdk-PP-OCRv6
```

预期：`locally-compliant`，required failed 为 0。

- [ ] **步骤 4：启动 Demo 并做浏览器烟雾检查**

```powershell
pnpm --filter @ppocrv6/demo dev -- --host 127.0.0.1
```

在桌面与 390×844 视口检查：顶部状态栏消失、左侧状态不挤压按钮、中间图片视口高度增加、右侧模型信息与耗时先于 OCR 结果、长错误文本不溢出、图片滚轮不带动页面滚动。

- [ ] **步骤 5：提交文档与最终修正**

```powershell
git add README.md README.en.md docs/zh-CN docs/en CHANGELOG.md docs/superpowers/specs/2026-08-25-ocr-progress-status-design.md docs/superpowers/plans/2026-08-25-ocr-progress-status.md
git commit -m "docs: 补充 OCR 进度和耗时说明"
```

- [ ] **步骤 6：检查最终提交范围**

```powershell
git status --short
git log --oneline -6
git diff origin/main...HEAD --stat
```

预期：工作区干净；差异仅包含本计划列出的 SDK、Demo、测试与文档文件。不推送或部署，除非用户另行明确要求远程操作。
