import { readFileSync } from "node:fs";
import { expect, test, type Page, type Response } from "playwright/test";

type ModelFixture = { base64: string; bytes: number; sha256: string; shape: number[] };
const models = JSON.parse(readFileSync(new URL("./fixtures/runtime-models.json", import.meta.url), "utf8")) as Record<"det" | "rec", ModelFixture>;

async function routeModels(page: Page, source: "modelscope" | "huggingface") {
  const hostname = source === "modelscope" ? "modelscope.cn" : "huggingface.co";
  const urls = { det: `https://${hostname}/runtime-regression/det.onnx`, rec: `https://${hostname}/runtime-regression/rec.onnx` };
  const manifest = {
    modelId: "ocr-runtime-regression", version: "1.0.0",
    assets: (["det", "rec"] as const).map((role) => ({
      id: `runtime-${role}`, role, preset: "small", bytes: models[role].bytes, sha256: models[role].sha256, url: urls[role],
      input: { name: "x", dtype: "float32", shape: [1, 3, "H", "W"] },
      output: { name: "output", dtype: "float32", shape: models[role].shape },
      preprocessing: {}, postprocessing: {}, decoder: { characters: ["A"], blankIndex: 0 }
    }))
  };
  // 仅替换外部模型传输，页面、SDK、Worker 和 WASM 均真实执行。
  await page.route(`https://${hostname}/**/manifest.json*`, (route) => route.fulfill({ json: manifest }));
  for (const role of ["det", "rec"] as const) {
    await page.route(urls[role], (route) => route.fulfill({ body: Buffer.from(models[role].base64, "base64"), contentType: "application/octet-stream" }));
  }
  return urls;
}

for (const mode of ["文本检测", "文本识别"] as const) {
  for (const execution of ["Worker", "主线程"] as const) {
    test(`${mode} ${execution} 只加载并执行对应的模型`, async ({ page }) => {
      const urls = await routeModels(page, "modelscope");
      const requests: string[] = [];
      page.on("request", (request) => { if (request.url().endsWith(".onnx")) requests.push(request.url()); });
      await page.goto("./");
      await page.getByRole("button", { name: mode, exact: true }).click();
      await page.getByRole("button", { name: execution, exact: true }).click();
      await page.getByRole("button", { name: "CPU", exact: true }).click();
      await page.getByRole("button", { name: "使用示例", exact: true }).click();
      await page.getByRole("button", { name: "开始识别", exact: true }).click();
      await expect(page.getByTestId("status")).toContainText("识别完成", { timeout: 20000 });
      expect(requests).toEqual([mode === "文本检测" ? urls.det : urls.rec]);
      await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("1");
      if (mode === "文本识别") await expect(page.getByTestId("ocr-results")).toContainText("A");
      else await expect(page.getByTestId("ocr-results")).not.toContainText("识别置信度");
      await expect(page.locator("[data-sdk-run-state]")).toHaveText("冷启动（新会话）");
      await page.getByRole("button", { name: "开始识别", exact: true }).click();
      await expect(page.getByTestId("status")).toContainText("识别完成");
      await expect(page.locator("[data-sdk-run-state]")).toHaveText("热运行（复用会话）");
      await expect(page.locator("[data-sdk-load-wall]")).toHaveText("0.0 ms");
      expect(requests).toEqual([mode === "文本检测" ? urls.det : urls.rec]);
    });
  }
}

for (const source of ["modelscope", "huggingface"] as const) {
  for (const execution of ["Worker", "主线程"] as const) {
    test(`普通页面 ${source} ${execution} 加载 WASM 并完成 OCR`, async ({ page }) => {
      await routeModels(page, source);
      const responses: Response[] = [];
      page.on("response", (response) => { if (new URL(response.url()).pathname.endsWith(".wasm")) responses.push(response); });
      await page.goto("./");
      await page.getByLabel("模型来源", { exact: true }).selectOption(source);
      await page.getByRole("button", { name: execution, exact: true }).click();
      await page.getByRole("button", { name: "CPU", exact: true }).click();
      await page.getByRole("button", { name: "使用示例", exact: true }).click();
      await page.getByRole("button", { name: "开始识别", exact: true }).click();
      await expect(page.getByTestId("status")).toContainText("识别完成", { timeout: 20000 });
      await expect(page.getByTestId("ocr-results").locator(".result-heading span")).toHaveText("1");
      await expect(page.getByTestId("ocr-results")).toContainText("A");
      await expect(page.getByTestId("status").locator(".error-text")).toHaveCount(0);
      await expect(page.locator("[data-sdk-run-state]")).toHaveText("冷启动（新会话）");
      expect(Number.parseFloat(await page.locator("[data-sdk-load-wall]").innerText())).toBeGreaterThan(0);
      await expect(page.locator("[data-sdk-run-phases]")).toContainText("图像解码");
      await expect(page.locator("[data-sdk-initialization]")).toContainText("首次初始化分项");
      await page.getByRole("button", { name: "开始识别", exact: true }).click();
      await expect(page.getByTestId("status")).toContainText("识别完成", { timeout: 20000 });
      await expect(page.locator("[data-sdk-run-state]")).toHaveText("热运行（复用会话）");
      await expect(page.locator("[data-sdk-load-wall]")).toHaveText("0.0 ms");
      for (const name of ["模型下载", "模型加载", "缓存读取", "完整性校验"]) {
        await expect(page.locator("[data-sdk-run-phases] > div").filter({ has: page.locator("dt", { hasText: name }) }).locator("dd")).toHaveText("0.0 ms");
      }
      expect(responses.length).toBeGreaterThan(0);
      for (const response of responses) {
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("application/wasm");
        const asset = await page.request.get(response.url());
        expect([...(await asset.body()).subarray(0, 4)]).toEqual([0, 97, 115, 109]);
        await asset.dispose();
      }
    });
  }
}

test("一路模型加载失败后，另一路的迟到进度不能覆盖错误状态", async ({ page }) => {
  const urls = await routeModels(page, "modelscope");
  let releaseRecognizer!: () => void;
  const gate = new Promise<void>((resolve) => { releaseRecognizer = resolve; });
  let recognizerStarted!: () => void;
  const started = new Promise<void>((resolve) => { recognizerStarted = resolve; });
  await page.route(urls.rec, async (route) => {
    recognizerStarted();
    await gate;
    await route.fulfill({ body: Buffer.from(models.rec.base64, "base64"), contentType: "application/octet-stream" });
  });
  await page.route(urls.det, async (route) => { await started; await route.fulfill({ status: 500 }); });
  await page.goto("./");
  await page.getByRole("button", { name: "CPU", exact: true }).click();
  await page.getByRole("button", { name: "使用示例", exact: true }).click();
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(page.getByTestId("status")).toContainText("MODEL_DOWNLOAD_FAILED");
  releaseRecognizer();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("status")).toContainText("识别失败");
  await expect(page.getByRole("button", { name: "开始识别", exact: true })).toBeEnabled();
});
