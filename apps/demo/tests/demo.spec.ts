import { expect, test } from "playwright/test";

test("模型来源默认沿用 SDK 并映射 Hugging Face manifest", async ({ page }) => {
  await page.goto("/?fixture=1");

  await expect(page.getByLabel("模型来源", { exact: true })).toHaveValue("default");
  await expect(page.getByLabel("模型来源").locator("option")).toHaveCount(3);
  await expect(page.getByRole("option", { name: "Hugging Face" })).toBeEnabled();
  await expect(page.getByRole("option", { name: /ModelScope/ })).toBeEnabled();
  await expect(page.getByText("模型清单", { exact: true })).toBeVisible();

  const contract = await page.evaluate(async (moduleUrl) => {
    const module = (await import(moduleUrl)) as typeof import("../src/model-sources");
    return {
      keys: module.MODEL_SOURCE_OPTIONS.map((option) => option.key),
      defaultModel: module.selectionToModel("default"),
      huggingFaceModel: module.selectionToModel("huggingface"),
      modelScopeModel: module.selectionToModel("modelscope"),
      available: module.MODEL_SOURCE_OPTIONS.map((option) => ({ key: option.key, available: option.available, disabledReason: option.disabledReason, manifestUrl: option.manifestUrl })),
      defaultRuntimeModel: module.runtimeModelForSelection("default", "small", "small", ""),
      presetRuntimeModel: module.runtimeModelForSelection("default", "medium", "tiny", ""),
      huggingFaceRuntimeModel: module.runtimeModelForSelection(
        "huggingface",
        "small",
        "small",
        "",
      ),
    };
  }, "/src/model-sources.ts");

  expect(contract.keys).toEqual(["default", "huggingface", "modelscope"]);
  expect(contract.defaultModel).toBeUndefined();
  expect(contract.huggingFaceModel).toEqual({
    manifestUrl: "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/main/manifest.json?v=1.0.0"
  });
  expect(contract.defaultRuntimeModel).toBeUndefined();
  expect(contract.presetRuntimeModel).toEqual({ det: "medium", rec: "tiny" });
  expect(contract.huggingFaceRuntimeModel).toEqual({
    det: { manifestUrl: "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/main/manifest.json?v=1.0.0" },
    rec: { manifestUrl: "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/main/manifest.json?v=1.0.0" },
  });
  expect(contract.modelScopeModel).toEqual({
    manifestUrl: "https://modelscope.cn/models/chenmohan/web-sdk-pp-ocrv6/resolve/master/manifest.json?v=1.0.0"
  });
  expect(contract.available).toEqual([
    { key: "default", available: true, manifestUrl: undefined },
    { key: "huggingface", available: true, disabledReason: undefined, manifestUrl: "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/main/manifest.json?v=1.0.0" },
    { key: "modelscope", available: true, disabledReason: undefined, manifestUrl: "https://modelscope.cn/models/chenmohan/web-sdk-pp-ocrv6/resolve/master/manifest.json?v=1.0.0" }
  ]);
});

test("切换模型来源会清空旧结果和自定义 manifest", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByLabel("检测模型").selectOption("medium");
  await page.getByLabel("识别模型").selectOption("medium");
  await page.getByLabel("自定义 manifest 地址").fill("https://example.com/custom.json");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("识别完成");
  await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("4");

  await page.getByLabel("模型来源").selectOption("huggingface");

  await expect(page.getByLabel("自定义 manifest 地址")).toHaveValue("");
  await expect(page.getByTestId("status")).toContainText("等待图片");
  await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("0");
  await expect(page.getByTestId("model-source-value")).toHaveText("Hugging Face");
  await expect(page.getByTestId("model-source-manifest")).toHaveText(
    "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/main/manifest.json?v=1.0.0",
  );
  await expect(page.getByLabel("检测模型")).toHaveValue("small");
  await expect(page.getByLabel("识别模型")).toHaveValue("small");
  await expect(page.getByLabel("检测模型")).toBeDisabled();
  await expect(page.getByLabel("识别模型")).toBeDisabled();
});

test("运行中切换模型来源不会回写已取消的结果", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("模型下载中");

  await page.getByLabel("模型来源").selectOption("huggingface");
  await expect(page.getByLabel("模型来源")).toBeDisabled();
  await expect(page.getByTestId("status")).toContainText("等待图片");
  await expect(page.getByLabel("模型来源")).toBeEnabled();
  await page.waitForTimeout(700);

  await expect(page.getByTestId("status")).toContainText("等待图片");
  await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("0");
});

test("starts in Chinese with the left-center-right OCR workflow", async ({ page }) => {
  await page.goto("/?fixture=1");
  await expect(page.getByRole("heading", { name: "PP-OCRv6" })).toBeVisible();
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();
  await expect(page.getByTestId("controls-panel")).toBeVisible();
  await expect(page.getByTestId("image-panel")).toBeVisible();
  await expect(page.getByTestId("details-panel")).toBeVisible();
  await expect(page.locator("[data-sdk-model-info]")).toBeVisible();
  await expect(page.locator("[data-sdk-runtime-info]")).toBeVisible();
  await expect(page.locator("[data-sdk-timing]")).toBeVisible();
  await expect(page.locator("[data-sdk-cache-clear]")).toHaveCount(2);
  await expect(page.locator(".statusbar")).toHaveCount(0);
  await expect(page.getByTestId("status")).toContainText("等待图片");
  expect(await page.getByTestId("ocr-results").evaluate((element) => element.clientHeight)).toBeGreaterThanOrEqual(240);
  expect(await page.getByTestId("details-panel").evaluate((panel) => {
    const metadata = panel.querySelector("[data-sdk-model-info]");
    const results = panel.querySelector("[data-testid=ocr-results]");
    return Boolean(metadata && results && metadata.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
});

test("defaults to automatic GPU-first backend selection with CPU fallback", async ({ page }) => {
  await page.goto("/?fixture=1");
  const compute = page.getByRole("group", { name: "计算设备" });
  expect(await compute.getByRole("button").allTextContents()).toEqual(["自动", "CPU", "GPU"]);
  await expect(compute.getByRole("button", { name: "自动" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: "允许自动回退" })).toBeChecked();
});

test("shows download, loading, running, and completed states in the controls", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("模型下载中");
  await expect(page.getByTestId("status")).toContainText("25%");
  await expect(page.getByTestId("download-progress")).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByTestId("status")).toContainText("模型加载中");
  await expect(page.getByTestId("status")).toContainText("识别中");
  await expect(page.getByTestId("status")).toContainText("识别完成");
  await expect(page.locator("[data-sdk-timing]")).toContainText("模型下载");
  await expect(page.locator("[data-sdk-timing]")).toContainText("模型加载");
  await expect(page.locator("[data-sdk-timing]")).toContainText("缓存读取");
  await expect(page.locator("[data-sdk-timing]")).toContainText("完整性校验");
});

test("renders stable error code and message in the compact status", async ({ page }) => {
  await page.goto("/?fixture=1&fixture-error=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("识别失败");
  await expect(page.getByTestId("status")).toContainText("MODEL_DOWNLOAD_FAILED · Failed to fetch");
});

test("runs the fixture, paints polygons, and links image and OCR row highlighting", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  const sourceImage = page.getByTestId("source-image");
  await expect.poll(() => sourceImage.boundingBox().then((box) => box?.width ?? 0)).toBeGreaterThan(100);
  await expect.poll(() => sourceImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("识别完成");
  const canvas = page.getByTestId("result-canvas");
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data.some((value) => value > 0))).toBe(true);
  const row = page.getByTestId("ocr-row-0");
  await row.click();
  await expect(row).toHaveAttribute("aria-current", "true");
  await canvas.click({ position: { x: 130, y: 83 } });
  await expect(row).toHaveAttribute("aria-current", "true");
});

test("keeps the image inside a fixed viewport and supports zoom and fit reset", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  const viewport = page.getByTestId("image-viewport");
  const canvas = page.getByTestId("result-canvas");
  await expect.poll(() => canvas.getAttribute("width")).toMatch(/^[1-9]\d+$/);
  await expect.poll(() => viewport.getAttribute("data-fit-scale")).not.toBe("1");
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => Number(await viewport.getAttribute("data-scale"))).toBeGreaterThan(Number(await viewport.getAttribute("data-fit-scale")));
  await page.getByRole("button", { name: "适配窗口", exact: true }).click();
  await expect.poll(async () => Number(await viewport.getAttribute("data-scale"))).toBeCloseTo(Number(await viewport.getAttribute("data-fit-scale")), 3);
  await expect(viewport).toHaveAttribute("data-offset-x", "0");
  await expect(viewport).toHaveAttribute("data-offset-y", "0");
});

test("supports persistent pan mode, temporary Space pan, and Escape exit", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  const viewport = page.getByTestId("image-viewport");
  await expect.poll(() => page.getByTestId("source-image").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "放大" }).click();
  const pan = page.getByRole("button", { name: "拖动查看" });
  await pan.click();
  await expect(pan).toHaveAttribute("aria-pressed", "true");
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 2, box.y + box.height * 2);
    await page.mouse.up();
    const offset = await viewport.evaluate((element) => ({ x: Number(element.getAttribute("data-offset-x")), y: Number(element.getAttribute("data-offset-y")), scale: Number(element.getAttribute("data-scale")) }));
    const canvasSize = await page.getByTestId("result-canvas").evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }));
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(Math.max(0, (canvasSize.width * offset.scale - box.width) / 2) + 1);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(Math.max(0, (canvasSize.height * offset.scale - box.height) / 2) + 1);
  }
  await page.keyboard.down("Space");
  await expect(viewport).toHaveAttribute("data-space-drag", "true");
  await page.keyboard.up("Space");
  await expect(viewport).toHaveAttribute("data-space-drag", "false");
  await page.keyboard.press("Escape");
  await expect(pan).toHaveAttribute("aria-pressed", "false");
});

test("keeps page scroll position when the pointer wheel is over the image viewport", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await expect(page.locator(".viewport-canvas")).toHaveCSS("overscroll-behavior", "contain");
  await page.evaluate(() => window.scrollTo(0, 160));
  const before = await page.evaluate(() => window.scrollY);
  const box = await page.getByTestId("image-viewport").boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 360);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
});

test("has no horizontal overflow at 390px and switches copy to English", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Start OCR" })).toBeVisible();
});

test("keeps the mobile OCR result area tall enough for long documents", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=1");
  expect(await page.getByTestId("ocr-results").evaluate((element) => element.clientHeight)).toBeGreaterThanOrEqual(520);
  expect(await page.locator(".viewport-canvas").evaluate((element) => ({ touchAction: getComputedStyle(element).touchAction }))).toMatchObject({ touchAction: "none" });
  expect(await page.getByTestId("image-viewport").evaluate((element) => element.clientWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("keeps the desktop workbench stable while the details column scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();

  const layout = await page.evaluate(() => {
    const topbar = document.querySelector<HTMLElement>(".topbar");
    const workspace = document.querySelector<HTMLElement>(".workspace");
    const imagePanel = document.querySelector<HTMLElement>(".image-panel");
    const canvasStage = document.querySelector<HTMLElement>(".canvas-stage");
    const details = document.querySelector<HTMLElement>(".details");
    const summary = document.querySelector<HTMLElement>(".details-summary");
    const results = document.querySelector<HTMLElement>(".ocr-results");
    if (!topbar || !workspace || !imagePanel || !canvasStage || !details || !summary || !results) throw new Error("workbench elements missing");
    return {
      viewportHeight: window.innerHeight,
      topbarHeight: topbar.getBoundingClientRect().height,
      workspaceHeight: workspace.getBoundingClientRect().height,
      pageScrollHeight: document.documentElement.scrollHeight,
      pageClientHeight: document.documentElement.clientHeight,
      imageTop: imagePanel.getBoundingClientRect().top,
      canvasStageHeight: canvasStage.getBoundingClientRect().height,
      summaryClientHeight: summary.clientHeight,
      summaryScrollHeight: summary.scrollHeight,
      resultsClientHeight: results.clientHeight,
    };
  });

  expect(Math.abs(layout.workspaceHeight - (layout.viewportHeight - layout.topbarHeight))).toBeLessThanOrEqual(1);
  expect(layout.pageScrollHeight).toBeLessThanOrEqual(layout.pageClientHeight + 1);
  expect(layout.canvasStageHeight).toBeGreaterThanOrEqual(700);
  expect(layout.summaryScrollHeight).toBeGreaterThan(layout.summaryClientHeight);
  expect(layout.resultsClientHeight).toBeGreaterThanOrEqual(220);

  const beforeScroll = layout.imageTop;
  await page.locator(".details-summary").evaluate((element) => { element.scrollTop = 240; });
  await expect.poll(() => page.getByTestId("image-panel").evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(beforeScroll, 0);
});
