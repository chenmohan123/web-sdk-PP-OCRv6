# 性能

[English](../en/performance.md)

以下计时修复与新增可选字段属于当前仓库源码，尚未发布到 npm 0.1.8；独立接入示例仍固定使用公开 0.1.8。

旧版自定义组件可以省略 `loadState`。聚合时，任一已执行组件明确为 `cold` 则报告 `cold`；所有已执行组件明确为 `warm` 才报告 `warm`，其余情况省略该字段，避免把未知状态推断为热运行。

结果保留九项毫秒字段：`modelDownloadMs`、`modelCacheReadMs`、`integrityMs`、`sessionMs`、`decodeMs`、`preprocessMs`、`inferenceMs`、`postprocessMs`、`totalMs`。它们表示当前调用：公开检测/识别的 `totalMs` 从进入运行方法到结果完成，包含该调用的初始化等待和实例队列等待；OCR 流水线的 `totalMs` 从自身队列开始执行到结果完成。

| 场景 | `timings.loadState` | 本次加载分项 | 初始化记录 |
| --- | --- | --- | --- |
| 未调用 `load()`，首次运行触发初始化 | `cold` | 包含本次启动的模型获取、校验和会话创建 | 可从结果和实例读取 |
| 新实例从缓存获取模型并创建会话 | `cold` | 下载为零，缓存读取、校验和会话创建按实测返回 | `source: "cache"` |
| 显式 `await load()` 完成后的首次运行 | `warm` | 下载、缓存读取、校验和会话创建均为零 | 保留历史初始化分项 |
| 已加载实例的后续运行 | `warm` | 四项加载分项均为零 | 保留同一初始化记录 |
| 运行中途加入尚未完成的 `load()` 或另一次初始化 | `cold` | 加载工作归最初发起者，本次四项为零；剩余等待仍计入 `totalMs` | 完整历史分项单列 |

`timings.initialization` 与实例的只读可选 `initialization` 提供首次初始化的四项分解。该历史记录不属于热运行的 `totalMs`，不要再加到本次耗时上。公开工厂还提供 `source: "network" | "cache" | "mixed"`；完整 OCR 可以一部分命中缓存、一部分下载。缓存命中不是热运行，因为新会话仍需创建。

`sessionMs` 包含公开工厂创建会话的实际等待，以及自动回退时失败的候选尝试和 Worker 启动/握手。模型分项只测 ONNX 模型获取及校验；清单解析、识别字典下载、队列等待和少量编排工作包含在端到端时间中，不保证九项之和等于 `totalMs`。完整 OCR 的分项为 DET/REC 累计工作量，显式 `load()` 会并行初始化两者，历史分项之和可能大于墙钟等待时间。

Demo 先测量 `load()` 的实际墙钟等待，再运行已加载的会话。首次显示“冷启动（新会话）”，后续显示“热运行（复用会话）”；“本次端到端”覆盖会话获取/替换与推理，“本次初始化等待”单独显示加载墙钟值，热运行该值为零。“SDK 本次运行”与其下方九项分解采用 SDK 的当前调用边界；“首次初始化分项”折叠区明确展示历史记录，不再用下载加会话时间冒充 CPU/GPU 冷启动等待。

OCR 的入口图片解码计入 `decodeMs`；检测和识别自身的解码工作按实际累计。空检测结果不运行 REC，其识别分项与 `stageTimings.recognitionMs` 均为零。`stageTimings` 是流水线分段观察，不能再加到 `timings` 上。

`runtime` 保留请求后端、实际后端、执行位置和 ONNX Runtime 版本。OCR 的新增 `componentBackends` 按实际执行报告 `det` 及可选 `rec`；空结果没有执行 REC，故省略 `rec`。为保持旧字段类型兼容，OCR 顶层 `actualBackend` 指 DET 实际后端；当 DET/REC 不同，必须查看 `componentBackends`，不能将顶层字段解释为统一 GPU。Demo 始终列出执行过的组件及其实际后端，配置控件变化不会篡改已有结果的运行环境。

完整 OCR 的下载进度仍按检测与识别模型的实际网络字节加权，缓存命中的模型不进入下载分母。移动端建议从 tiny 或 small 开始。比较 CPU/GPU 时应固定设备、浏览器、模型和输入，分别记录新会话初始化、缓存初始化及多次热运行。当前验证证据见 [2026-09-08 验收记录](../validation/runtime-performance-2026-09-08.md)；具体环境的观察不构成其他设备或 NPU 兼容承诺。
