# OCR 自动后端与会话复用实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 将 Demo 的计算设备默认改为“自动”（GPU 优先、CPU 回退），并在配置不变时复用已经加载的 OCR 会话，避免重复加载模型会话。

**架构：** SDK 的 `selectExecutionPlan` 已经定义 `auto + allowFallback` 的 WebGPU→WASM 候选顺序；Demo 只需把默认配置设为 `auto/allowFallback=true`，并维护一个可比较的运行配置键。每次识别复用同配置实例，配置变化或组件卸载时释放实例，更换图片和重置结果保留已加载会话。

**技术栈：** React 19、TypeScript、Vite、Playwright、Vitest。

---

### 任务 1：锁定 SDK 自动后端候选顺序

**文件：**
- 验证：`packages/sdk/tests/runtime-selector.test.ts`

- [x] **步骤 1：验证现有自动候选顺序测试**

运行 `pnpm --filter web-sdk-pp-ocrv6 test -- runtime-selector`，确认 `backend: "auto", allowFallback: true` 的候选顺序为 `["webgpu", "wasm"]`；SDK 未显式配置时的默认 `wasm` 行为保持不变。

### 任务 2：调整 Demo 默认设备和选项顺序

**文件：**
- 修改：`apps/demo/src/App.tsx`
- 修改：`apps/demo/tests/demo.spec.ts`

- [x] **步骤 1：写失败测试**

在 Demo 初始状态测试中断言“自动”按钮位于计算设备分段第一位且已按下，并断言允许自动回退复选框默认选中。

- [x] **步骤 2：运行测试确认失败**

运行 `pnpm --filter @ppocrv6/demo test -- tests/demo.spec.ts`，预期当前默认 CPU 和未选中的回退复选框导致失败。

- [x] **步骤 3：实现最小修改**

将 `backend` 初始状态改为 `"auto"`，`allowFallback` 初始状态改为 `true`，并把计算设备按钮顺序改为 `auto/wasm/webgpu`。

- [x] **步骤 4：运行测试确认通过**

再次运行同一 Playwright 测试文件，预期初始状态断言通过。

### 任务 3：复用同配置 OCR 实例

**文件：**
- 新建：`apps/demo/src/ocr-session.ts`
- 新建：`apps/demo/src/ocr-session.test.ts`
- 修改：`apps/demo/src/App.tsx`

- [x] **步骤 1：写失败测试**

为会话管理器写测试：相同配置键连续获取两次只创建并加载一次；配置键变化时释放旧实例并加载新实例；最终 `dispose()` 释放当前实例。

- [x] **步骤 2：运行测试确认失败**

运行 `pnpm --filter @ppocrv6/demo exec vitest run src/ocr-session.test.ts`，预期因会话管理器尚不存在而失败。

- [x] **步骤 3：实现最小修改**

新增稳定配置键，包含自定义 manifest、检测/识别模型、后端、执行位置和回退开关。会话管理器在键相同且实例存在时返回原实例；键变化时先释放旧实例，再新建并 `load()`。组件卸载时释放实例；更换图片和重置结果不释放模型会话。

- [x] **步骤 4：运行测试确认通过**

运行会话管理器测试、Demo Playwright 测试以及 `pnpm --filter @ppocrv6/demo typecheck`，预期复用、配置变化和现有 UI 流程全部通过。

### 任务 4：完整验证

**文件：** 无新增。

- [x] **步骤 1：运行 SDK 单测与类型检查**

运行 `pnpm --filter web-sdk-pp-ocrv6 test` 和 `pnpm --filter web-sdk-pp-ocrv6 typecheck`。

- [x] **步骤 2：运行 Demo 构建与测试**

运行 `pnpm --filter @ppocrv6/demo build` 和 `pnpm --filter @ppocrv6/demo test`。

- [x] **步骤 3：运行标准检查**

在门户仓库运行 `pnpm sdk:check -- --repo F:\git\00_chenmohan\github\web-sdk-PP-OCRv6 --format table`，记录 required 规则结果。
