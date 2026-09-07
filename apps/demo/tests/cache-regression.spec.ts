import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../../../models/pp-ocrv6/manifest.json", import.meta.url), "utf8"));

test("下载中清理会取消任务、撤下结果且恢复按钮", async ({ page }) => {
  await page.goto("/?fixture=1");
  await page.getByRole("button", { name: "使用示例" }).click();
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("模型下载中");
  await page.getByRole("button", { name: "清除此模型缓存" }).click();
  await expect(page.getByText("缓存已清理", { exact: true })).toBeVisible();
  await expect(page.getByTestId("status")).toContainText("等待图片");
  await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("0");
  await expect(page.locator("[data-sdk-cache-usage]")).toContainText("0 B");
  await page.getByRole("button", { name: "开始识别" }).click();
  await expect(page.getByTestId("status")).toContainText("识别完成");
});

test("自定义 manifest 按实际身份统计和清理，失败后可重试", async ({ page }) => {
  const custom = { ...manifest, modelId: "custom-cache", version: "2.0.0" };
  await page.route("https://custom.test/manifest.json", (route) => route.fulfill({ json: custom }));
  await page.goto("/?fixture=1");
  await page.evaluate(async () => {
    const request = indexedDB.open("web-sdk-pp-ocrv6", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onupgradeneeded = () => request.result.createObjectStore("models"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = db.transaction("models", "readwrite");
    for (const [modelId, version, size] of [["custom-cache", "2.0.0", 7], ["pp-ocrv6", "1.0.0", 11]] as const) {
      const identity = { modelId, version, variant: "test", sha256: "a" };
      transaction.objectStore("models").put({ identity, bytes: new Uint8Array(size).buffer }, [modelId, version, "test", "a"].map(encodeURIComponent).join("/"));
    }
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); });
    db.close();
  });
  await page.getByLabel("自定义 manifest 地址").fill("https://custom.test/manifest.json");
  await expect(page.locator("[data-sdk-cache-usage]")).toContainText("当前模型缓存: 7 B");
  await expect(page.locator("[data-sdk-cache-usage]")).toContainText("本 SDK 全部缓存: 18 B");
  await page.getByRole("button", { name: "清除此模型缓存" }).click();
  await expect(page.locator("[data-sdk-cache-usage]")).toContainText("本 SDK 全部缓存: 11 B");
  await page.getByLabel("自定义 manifest 地址").fill("https://invalid.test/manifest.json");
  await page.route("https://invalid.test/**", (route) => route.fulfill({ status: 500 }));
  await page.getByRole("button", { name: "清除此模型缓存" }).click();
  await expect(page.getByTestId("status")).toContainText("CACHE_CLEAR_FAILED");
  await expect(page.getByRole("button", { name: "清除全部缓存" })).toBeEnabled();
  await page.getByLabel("自定义 manifest 地址").fill("https://custom.test/manifest.json");
  await page.getByRole("button", { name: "清除全部缓存" }).click();
  await expect(page.locator("[data-sdk-cache-usage]")).toContainText("本 SDK 全部缓存: 0 B");
});
