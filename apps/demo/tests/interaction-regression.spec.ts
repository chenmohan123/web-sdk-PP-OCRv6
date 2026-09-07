import { expect, test } from "playwright/test";

const replacement = { name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDU0AAAAASUVORK5CYII=", "base64") };

test("运行中换图不会显示上一张图片的结果", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("模型下载中");
  await page.locator('input[type="file"]').setInputFiles(replacement);
  await page.waitForTimeout(700);
  await expect(page.getByTestId("status")).toContainText("等待图片");
  await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("0");
});

test("重置后立即重跑不会被旧任务清空状态", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await page.getByTitle("重置", { exact: true }).click();
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("识别完成");
  await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("4");
});

test("等待旧任务结束时停止新任务会恢复可运行状态", async ({ page }) => {
  const now = new Date("2026-09-07T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例", exact: true }).click();
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(page.getByTestId("status")).toContainText("模型下载中");
  await page.locator('input[type="file"]').setInputFiles(replacement);
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await page.getByTitle("停止", { exact: true }).click();
  await page.clock.runFor(150);
  await expect(page.getByTestId("status")).toContainText("等待图片");
  await expect(page.getByRole("button", { name: "开始识别", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await page.clock.runFor(450);
  await expect(page.getByTestId("status")).toContainText("识别完成");
});

for (const action of ["上传", "重置"] as const) {
  for (const responseStatus of [200, 500]) {
    test(`示例图片的迟到响应 ${responseStatus} 不会覆盖${action}`, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => { markStarted = resolve; });
      await page.route("**/samples/ocr-fixture.png", async (route) => {
        markStarted();
        await gate;
        await route.fulfill({ status: responseStatus, body: replacement.buffer, contentType: "image/png" });
      });
      await page.goto("/?fixture=1");
      await page.getByRole("button", { name: "使用示例", exact: true }).click();
      await started;
      if (action === "上传") await page.locator('input[type="file"]').setInputFiles(replacement);
      else await page.getByTitle("重置", { exact: true }).click();
      const uploadedUrl = action === "上传" ? await page.getByTestId("source-image").getAttribute("src") : undefined;
      const response = page.waitForResponse("**/samples/ocr-fixture.png");
      release();
      await (await response).finished();
      // 等待响应完成后的 React 更新，避免只检查到响应到达前的状态。
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      if (action === "上传") await expect(page.getByTestId("source-image")).toHaveAttribute("src", uploadedUrl!);
      else await expect(page.getByTestId("source-image")).toHaveCount(0);
      await expect(page.getByTestId("status")).toContainText("等待图片");
      await expect(page.getByTestId("status").locator(".error-text")).toHaveCount(0);
    });
  }
}

test("适配窗口使用绘图区尺寸并准确选中文本行", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("识别完成");
  const area = (await page.locator(".viewport-canvas").boundingBox())!;
  const canvas = (await page.getByTestId("result-canvas").boundingBox())!;
  expect(canvas.y).toBeGreaterThanOrEqual(area.y - 1);
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(area.y + area.height + 1);
  await page.mouse.click(canvas.x + canvas.width * 200 / 820, canvas.y + canvas.height * 295 / 1024);
  await expect(page.getByTestId("ocr-row-1")).toHaveAttribute("aria-current", "true");
});
