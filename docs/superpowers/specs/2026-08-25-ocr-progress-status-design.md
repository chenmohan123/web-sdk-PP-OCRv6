# PP-OCRv6 进度状态与耗时展示设计

## 背景

当前 Demo 顶部独立状态栏占用工作区高度，且 SDK 的模型下载与 Worker
进度没有对外暴露。用户在加载模型或识别失败时只能看到粗粒度状态，无法
区分模型下载、模型加载和识别阶段，也无法查看稳定错误码对应的具体错误。

## 目标

- 删除顶部独立状态栏，把运行状态放到左侧控制区的运行按钮附近。
- 对外提供 SDK 进度回调，支持模型下载的真实字节百分比；不支持流式响应
  时退化为无百分比的“模型下载中”。
- 在 Demo 中展示“模型下载中”“模型加载中”“识别中”“识别完成”以及带
  稳定错误码和错误消息的失败状态。
- 在右侧信息区拆分总耗时、模型下载、模型加载、预处理、推理和后处理，
  保持与性能契约中的字段一致。
- 保持 SDK 框架无关，Worker 和主线程使用同一套进度语义。

## 非目标

- 不为 ONNX Runtime 的会话创建伪造百分比。会话阶段只报告开始和完成，
  Demo 显示为“模型加载中”。
- 不改变模型清单、缓存键、后端选择或错误码集合。
- 不把模型文件打进 npm 包，也不引入 React 作为 SDK 运行时依赖。

## 公开契约

在 `packages/sdk/src/types.ts` 增加：

```ts
export type OCRProgressPhase =
  | "manifest"
  | "cache"
  | "download"
  | "integrity"
  | "load"
  | "inference";
export type OCRProgressComponent = "det" | "rec";
export interface OCRProgress {
  readonly phase: OCRProgressPhase;
  readonly component?: OCRProgressComponent;
  readonly progress?: number;
  readonly loadedBytes?: number;
  readonly totalBytes?: number;
}
```

`RuntimeOptions` 增加可选字段：

```ts
readonly onProgress?: (event: OCRProgress) => void;
```

事件约定如下：

- `manifest`：清单获取阶段；可只发送阶段开始和完成事件，不承诺百分比。
- `cache`：读取当前模型缓存；发送 `0` 和 `1` 两个边界事件。
- `download`：模型文件下载阶段；`progress` 为 `[0, 1]`，同时尽可能提供
  `loadedBytes` 和 `totalBytes`。检测与识别文件按清单字节数加权合并，
  使 Demo 的百分比代表本次加载的全部模型。
- `integrity`：文件大小与 SHA-256 校验；发送 `0` 和 `1` 两个边界事件。
- `load`：ONNX Runtime 会话创建；发送 `0` 和 `1` 两个边界事件。
- `inference`：一次推理的开始与完成；发送 `0` 和 `1` 两个边界事件。

进度回调异常不得中断模型加载或推理。若 `Response.body` 或
`getReader()` 不可用，下载器仍使用 `arrayBuffer()` 完成下载，并发送不带
百分比的下载阶段事件。取消请求继续映射为 `ABORTED`。

## SDK 数据流

1. 模型管理器获取清单并触发 `manifest` 事件。
2. 模型管理器在缓存读取和完整性校验前后触发 `cache` 与 `integrity` 事件。
3. 下载器通过 `ReadableStreamDefaultReader` 累积字节，按当前文件和全部
   模型大小计算进度，完成后校验 SHA-256 并返回现有耗时字段。
4. 主线程创建 ORT 会话时把 `session` 事件映射为公开的 `load` 事件。
5. Worker 协议保留 `progress` 消息，Worker Bridge 将其转发给调用方，不再
   静默丢弃；执行器把 `load` 和 `inference` 事件统一传给 `onProgress`。
6. 现有 `TimingBreakdown` 字段继续作为结果唯一计时来源，Demo 不自行推断
   模型阶段耗时。

## Demo 状态与布局

左侧控制区在运行按钮下方显示紧凑状态块：

- 空闲：准备就绪。
- 下载：`模型下载中 25%`，带细进度条；无百分比时隐藏数值但保留阶段名。
- 加载：`模型加载中`；清单、缓存、校验和会话创建均映射到此状态。
- 运行：`识别中`。
- 成功：`识别完成`。
- 错误：`识别失败`，下一行显示 `错误码 · 具体消息`。

状态块使用 `data-testid="status"` 和标准状态类，继续覆盖
`idle/downloading/loading/ready/running/success/error/unsupported` 语义。
缓存清理反馈仍放在右侧缓存按钮下方，避免与运行状态混淆。

右侧 `data-sdk-timing` 区域展示：

- 总耗时：`totalMs`。
- 模型下载：`modelDownloadMs`；缓存命中时显示为 `0 ms` 并保留缓存读取
  作为次级信息。
- 模型加载：`sessionMs`，可在辅助文本中包含 `modelCacheReadMs` 和
  `integrityMs`。
- 预处理、推理、后处理：对应现有字段。

布局保持三列桌面布局和现有移动端断点，不允许新增横向溢出；状态块在
`390px` 宽度下允许换行，错误消息使用 `overflow-wrap: anywhere`。

## 错误处理

Demo 捕获 `PPOCRv6Error`，优先显示其 `code` 与 `message`；未知异常回退到
`INFERENCE_FAILED`。取消操作恢复空闲状态，不显示错误。SDK 不修改现有
错误码语义，下载网络错误继续使用 `MODEL_DOWNLOAD_FAILED`。

## 测试与验收

- SDK 单元测试：下载流进度、无流回退、进度回调异常隔离、Worker 进度转发、
  会话和推理边界事件、下载/加载耗时字段不回归。
- Demo 类型检查和 Playwright：状态阶段文案、真实百分比、错误码展示、
  计时行存在、顶部状态栏已移除、移动端不横向溢出。
- 运行 `pnpm verify`、SDK/Demo typecheck、SDK/Demo build、相关测试，以及
  门户 `pnpm sdk:check -- --repo F:\git\00_chenmohan\github\web-sdk-PP-OCRv6`。

## 兼容性与限制

- Chromium、Firefox、Safari 中只要 `fetch` 可用即可运行；不支持流式响应的
  浏览器不会显示下载百分比，但仍会显示阶段和最终耗时。
- WebGPU、WASM、Worker/main 的选择逻辑不变；进度事件只增加观察能力，不
  改变后端回退策略。
- 公开事件类型必须写入生成的 `.d.ts`，并在 README 的 SDK 使用示例中说明
  生命周期和降级行为。
