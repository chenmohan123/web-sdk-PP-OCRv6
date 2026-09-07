import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const require = createRequire(join(root, "apps/demo/package.json"));
const { chromium } = require("playwright");
const directory = resolve(process.argv[2]);
const models = JSON.parse(await readFile(join(root, "apps/demo/tests/fixtures/runtime-models.json"), "utf8"));
const browser = await chromium.launch({ headless: true });
let served = directory;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const path = resolve(served, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
    if (!path.startsWith(served + sep)) { response.writeHead(403).end(); return; }
    response.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm" })[extname(path)] ?? "application/octet-stream");
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
try {
  for (const name of process.argv.includes("--cdn") ? ["cdn", "wechat-web-view"] : ["vanilla", "react", "vite"]) {
    served = ["cdn", "wechat-web-view"].includes(name) ? join(root, "examples", name) : join(directory, name, "dist");
    for (const source of ["modelscope", "huggingface"]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const hostname = source === "modelscope" ? "modelscope.cn" : "huggingface.co";
      const manifest = { modelId: "consumer-regression", version: "1.0.0", assets: ["det", "rec"].map((role) => ({ id: role, role, preset: "tiny", bytes: models[role].bytes, sha256: models[role].sha256, url: `https://${hostname}/test/${role}.onnx`, input: { name: "x", dtype: "float32", shape: [1, 3, "H", "W"] }, output: { name: "output", dtype: "float32", shape: models[role].shape }, preprocessing: {}, postprocessing: {}, decoder: { characters: ["A"], blankIndex: 0 } })) };
      // 仅替换模型传输，实际执行独立目录安装的 0.1.8、ORT 和 WASM。
      await page.route(`https://${hostname}/**/manifest.json*`, (route) => route.fulfill({ json: manifest }));
      for (const role of ["det", "rec"]) await page.route(`https://${hostname}/test/${role}.onnx`, (route) => route.fulfill({ body: Buffer.from(models[role].base64, "base64"), contentType: "application/octet-stream" }));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.getByLabel("模型来源").selectOption(source);
      await page.locator('input[type="file"]').setInputFiles(join(root, "apps/demo/public/samples/ocr-fixture.png"));
      await page.getByRole("button", { name: "开始识别" }).click();
      await page.waitForFunction(() => document.querySelector("pre")?.textContent?.includes('"lines"'), undefined, { timeout: 30000 });
      const result = JSON.parse(await page.locator("pre").textContent());
      assert.equal(result.lines[0].text, "A");
      assert.equal(result.runtime.actualBackend, "wasm");
      assert.equal(await page.getByRole("button", { name: "开始识别" }).isEnabled(), true);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${name} / ${source}：公开 0.1.8 实际 WASM OCR 通过`);
    }
  }
} finally { await browser.close(); await new Promise((done) => server.close(done)); }
