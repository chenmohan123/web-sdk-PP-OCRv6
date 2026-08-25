# OCR 图片视口交互 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Demo 中间图片区改造成固定视口内的单画布预览，支持适配、滚轮/按钮缩放、按钮拖动、空格临时拖动、Esc 退出，以及移动端单指拖动和双指缩放。

**Architecture:** 把缩放比例、平移偏移和边界钳制放进纯 TypeScript 几何模块，React 组件只负责事件会话和渲染。原图与检测框继续绘制到同一 canvas，外层视口固定尺寸并隐藏溢出；所有变换只作用于 canvas，不改变页面网格尺寸。

**Tech Stack:** React 19、TypeScript 5.9、Vite、Playwright、Canvas 2D API。

---

### Task 1: 添加可验证的视口几何测试

**Files:**
- Create: `apps/demo/src/imageViewport.test.ts`
- Modify: `apps/demo/package.json`

- [ ] **Step 1: 写纯函数测试**

测试 `fitScale`、`clampOffset` 和 `zoomAroundPoint`：图片 `820x1024` 在 `640x420` 视口内适配比例为 `420 / 1024`；放大后偏移不能让图片边缘露出空白；在鼠标点 `(100, 80)` 缩放时，该点对应的图片坐标保持不变。

```ts
import { describe, expect, it } from "vitest";
import { clampOffset, fitScale, zoomAroundPoint } from "./imageViewport";

describe("image viewport geometry", () => {
  const image = { width: 820, height: 1024 };
  const viewport = { width: 640, height: 420 };

  it("fits the whole image into the viewport", () => {
    expect(fitScale(image, viewport)).toBeCloseTo(420 / 1024, 5);
  });

  it("keeps the scaled image covering the viewport", () => {
    expect(clampOffset({ x: 9999, y: -9999 }, 1, image, viewport)).toEqual({ x: 90, y: -302 });
  });

  it("keeps the pointer anchored while zooming", () => {
    const next = zoomAroundPoint({ x: 0, y: 0 }, 0.5, 1, { x: 100, y: 80 }, image, viewport);
    expect(next.offset.x).toBeCloseTo(-100);
    expect(next.offset.y).toBeCloseTo(-80);
  });
});
```

- [ ] **Step 2: 配置最小的 Vitest 测试命令**

在 `apps/demo/package.json` 增加 `"unit": "vitest run"`，并增加与现有 workspace 版本一致的 `vitest` 开发依赖；运行 `pnpm --filter @ppocrv6/demo unit`，预期因 `imageViewport.ts` 尚不存在而失败。

### Task 2: 实现视口几何模块

**Files:**
- Create: `apps/demo/src/imageViewport.ts`

- [ ] **Step 1: 定义尺寸、偏移和缩放结果类型**

实现 `fitScale(image, viewport)` 返回不超过 `1` 的完整适配比例；实现 `clampOffset(offset, scale, image, viewport)`，当缩放后图片小于视口时返回居中偏移，当图片大于视口时将偏移限制在 `±(scaledSize - viewportSize) / 2`。

- [ ] **Step 2: 实现以指针为中心的缩放**

实现 `zoomAroundPoint(offset, scale, nextScale, point, image, viewport)`：将指针相对视口中心的坐标换算为图片坐标，更新缩放后偏移，再调用 `clampOffset`；返回 `{ scale, offset }`。

- [ ] **Step 3: 运行纯函数测试**

运行 `pnpm --filter @ppocrv6/demo unit`，预期 3 个测试通过。

### Task 3: 抽取可交互的 ImageViewport 组件

**Files:**
- Create: `apps/demo/src/ImageViewport.tsx`
- Modify: `apps/demo/src/App.tsx`

- [ ] **Step 1: 创建组件 props 和状态**

`ImageViewport` 接收 `imageUrl`、`imageAlt`、`imageReady`、`lines`、`selected` 和 `onSelect`。组件内部维护 `scale`、`fitScaleValue`、`offset`、`interactionMode`、`spacePressed`、拖动会话和双指会话。图片加载后用自然尺寸计算适配比例，图片源变化时重置到适配状态。

- [ ] **Step 2: 将原图与检测框统一绘制到 canvas**

canvas 使用原图自然宽高作为内部尺寸，绘制原图和现有 `lines` 多边形；选中行使用橙色，否则绿色。canvas 通过 `transform: translate(offset.x, offset.y) scale(scale)` 放在固定 `.image-viewport` 内，避免用 img 与 canvas 两层叠加造成尺寸不同步。

- [ ] **Step 3: 实现桌面缩放和拖动**

滚轮调用 `zoomAroundPoint`，按钮 `+/-` 使用视口中心作为锚点，缩放范围为适配比例到 `2.4`。点击“拖动查看”切换持续模式；按下空格设置临时拖动；`Esc` 关闭持续模式；pointer down/move/up 按边界钳制偏移。拖动模式按钮设置 `aria-pressed`，比例显示为百分比，“适配窗口”清零偏移并恢复适配比例。

- [ ] **Step 4: 实现移动端手势**

视口设置 `touch-action: none`。单指在拖动模式、空格临时模式或当前已放大时平移；双指以两指中心为锚点调用同一缩放函数，并同步平移。指针结束/取消时清理会话，不能改变外部页面尺寸。

- [ ] **Step 5: 替换 App 中旧的 img/canvas 结构**

删除 `App.tsx` 中的 `canvasRef`、`imageRef` 和绘制 effect，保留 `imageReady` 状态用于组件加载回调；在 `.canvas-stage` 内渲染 `<ImageViewport ... />`，点击检测框仍通过 `onSelect` 更新 `selected`。

### Task 4: 固定视口样式和国际化文案

**Files:**
- Modify: `apps/demo/src/styles.css`
- Modify: `apps/demo/src/i18n/zh-CN.ts`
- Modify: `apps/demo/src/i18n/en.ts`

- [ ] **Step 1: 固定中间视口尺寸**

`.canvas-stage` 使用 `min-height: 0; height: clamp(420px, calc(100vh - 220px), 760px); flex: 1 1 auto; overflow: hidden;`；`.image-viewport` 为 `position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none;`。移动端将高度设为 `min(560px, 70vh)` 且保留 `min-height: 400px`，不让长图改变页面宽度。

- [ ] **Step 2: 添加工具栏和交互状态样式**

为缩放按钮、适配按钮、拖动按钮、比例文本和视口 cursor 增加现有 token 风格；持续拖动使用 `cursor: grab/grabbing`，选择模式使用 `cursor: crosshair`。

- [ ] **Step 3: 添加中英文文案**

新增 `zoomIn`、`zoomOut`、`fitView`、`pan`、`panHint` 和 `zoomPercent`，按钮同时设置 `title` 与 `aria-label`。

### Task 5: 添加 Demo 交互回归测试

**Files:**
- Modify: `apps/demo/tests/demo.spec.ts`

- [ ] **Step 1: 验证默认适配和固定边界**

fixture 加载后断言 `[data-testid=image-viewport]` 的尺寸稳定、canvas 的 bounding box 不超过视口，并读取 `data-scale` 等测试属性确认偏移为零。

- [ ] **Step 2: 验证滚轮、按钮缩放和适配恢复**

在视口中心滚轮向上，断言 `data-scale` 增大；点击“适配窗口”，断言比例回到 `data-fit-scale` 且 `data-offset-x/y` 回到零。

- [ ] **Step 3: 验证拖动模式、空格和 Esc**

点击“拖动查看”断言 `aria-pressed=true`，按 `Escape` 断言恢复 false；按住空格时断言视口进入拖动状态，松开后持续模式状态不被改变。

- [ ] **Step 4: 验证移动端无溢出**

在 `390x844` 视口运行现有无横向溢出测试，并断言图片视口和 OCR 结果区域都在页面宽度内。

### Task 6: 构建、标准检查和提交

**Files:**
- Modify: `pnpm-lock.yaml`（如安装 Vitest 产生锁文件变化）
- Modify: `CHANGELOG.md`（记录 Demo 图片视口交互）

- [ ] **Step 1: 运行类型检查、单元测试、Demo 测试和构建**

运行 `pnpm --filter @ppocrv6/demo typecheck`、`pnpm --filter @ppocrv6/demo unit`、`pnpm --filter @ppocrv6/demo test` 和 `pnpm --filter @ppocrv6/demo build`，全部返回 0。

- [ ] **Step 2: 运行 SDK 标准检查**

在门户仓库执行 `pnpm sdk:check -- --repo F:\git\00_chenmohan\github\web-sdk-PP-OCRv6`，确认没有新增 required 失败。

- [ ] **Step 3: 更新变更记录并检查工作区**

在 `CHANGELOG.md` 的当前版本下记录图片视口交互；运行 `git diff --check` 和 `git status --short`，确认没有无关文件。

- [ ] **Step 4: 提交改动**

```powershell
git add apps/demo/src apps/demo/tests apps/demo/package.json docs/superpowers CHANGELOG.md pnpm-lock.yaml
git commit -m "feat: 增强 OCR 图片视口交互"
```

