import { expect, test } from "playwright/test";

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
  expect(await page.getByTestId("ocr-results").evaluate((element) => element.clientHeight)).toBeGreaterThanOrEqual(400);
  expect(await page.getByTestId("details-panel").evaluate((panel) => {
    const metadata = panel.querySelector("[data-sdk-model-info]");
    const results = panel.querySelector("[data-testid=ocr-results]");
    return Boolean(metadata && results && metadata.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
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
});
