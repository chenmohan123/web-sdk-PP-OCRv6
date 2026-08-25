# OCR 工作台滚动布局修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PP-OCRv6 Demo 在桌面端保持图片工作区稳定，同时让右侧 OCR 结果独立滚动并获得首屏剩余高度。

**Architecture:** 只调整 Demo 的布局 CSS、详情区容器和浏览器回归测试，不改变 SDK 推理、结果数据或图片视口交互。桌面工作区固定为顶部栏下的视口高度，左侧控制栏滚动，右侧详情栏拆成可滚动的信息摘要区和约占一半高度的 OCR 列表；平板/移动端继续沿用现有堆叠布局。

**Tech Stack:** React 19, TypeScript, Vite, Playwright, CSS Grid/Flexbox。

---

### Task 1: 锁定桌面工作区滚动行为的失败测试

**Files:**
- Modify: `apps/demo/tests/demo.spec.ts`

- [ ] **Step 1: 添加桌面端工作区几何与滚动测试**

在现有 Demo 测试后加入测试：设置 1440x900 视口，加载 `?fixture=1` 和示例图片，读取 `.workspace`、`.topbar`、`.image-panel`、`.details-summary` 与 `.ocr-results` 的矩形；断言工作区高度等于 `innerHeight - topbar.height`（允许 1px 误差），`document.documentElement.scrollHeight` 不超过 `clientHeight + 1`，摘要区的 `scrollHeight` 大于 `clientHeight`，OCR 列表的 `clientHeight` 大于等于 220px。将摘要区滚动到 `scrollTop = 240`，再次读取图片区顶部，断言前后差值不超过 1px。

- [ ] **Step 2: 运行测试确认当前实现失败**

运行：`pnpm --filter @ppocrv6/demo test -- --grep "keeps the desktop workbench stable"`

预期：失败，当前工作区会被详情内容撑高或页面滚动高度超过视口，且 OCR 列表固定高度不能证明其使用剩余空间。

### Task 2: 实现固定工作区和独立详情滚动

**Files:**
- Modify: `apps/demo/src/styles.css:26-90`

- [ ] **Step 1: 固定桌面工作区高度并禁止页面被子项撑高**

将 `.workspace` 改为 `height: calc(100vh - 68px); min-height: 0; overflow: hidden;`，保留现有三列网格定义。将 `.controls` 改为 `height: 100%; min-height: 0; overflow-y: auto;`。将 `.image-panel` 改为 `height: 100%; min-height: 0; overflow: hidden;`，让 `.canvas-stage` 继续占据可用空间。

- [ ] **Step 2: 拆分右栏摘要区和 OCR 列表**

在 `apps/demo/src/App.tsx` 中用 `.details-summary` 包住模型、运行环境、耗时和缓存四个 section；`.details-summary` 使用 `flex: 1 1 50%; min-height: 0; overflow-y: auto`，`.ocr-results` 使用 `flex: 1 1 50%; min-height: 220px; overflow-y: auto`。删除桌面端固定 `420px` 高度和 `flex-basis: 420px`，避免窗口高度变化时列表被硬编码限制。

- [ ] **Step 3: 保持响应式断点不被桌面规则污染**

在 `@media (max-width: 1023px)` 中恢复工作区为 `height: auto; min-height: 0; overflow: visible;`，让详情区自然落到下方；保留现有 `.ocr-results { max-height: 360px; }`。在移动断点中继续使用现有 `560px` OCR 高度，并显式将 `.details` 的 `height` 设为 `auto`、`overflow` 设为 `visible`，避免继承桌面滚动容器。

### Task 3: 回归验证并记录结果

**Files:**
- Modify: `apps/demo/tests/demo.spec.ts`（仅在测试需要 1px 容差调整时）

- [ ] **Step 1: 运行 Demo 类型检查和全部浏览器测试**

运行：`pnpm --filter @ppocrv6/demo typecheck`；`pnpm --filter @ppocrv6/demo test`

预期：类型检查通过；全部测试通过，包括图片滚轮不推动页面、缩放/拖动、桌面三栏、移动端无横向溢出和 OCR 联动。

- [ ] **Step 2: 构建 Demo 验证 CSS/资源产物**

运行：`pnpm --filter @ppocrv6/demo build`

预期：Vite 构建成功，`apps/demo/dist` 生成可部署产物。

- [ ] **Step 3: 检查差异和工作区状态**

运行：`git diff --check`；`git status --short`

预期：无空白错误；仅包含本设计文档、实施计划、Demo CSS 和测试变更。
