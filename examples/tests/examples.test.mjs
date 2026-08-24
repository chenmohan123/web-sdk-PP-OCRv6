import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const examples = ["vanilla", "react", "vite", "cdn", "wechat-web-view"];
test("every declared example is runnable and version-aware", async () => {
  for (const name of examples) {
    const readme = await readFile(`examples/${name}/README.md`, "utf8");
    assert.match(readme, /web-sdk-pp-ocrv6/);
    assert.match(readme, /(pnpm|npm|npx|http)/i, `${name} needs a run command`);
  }
});

test("examples use the stable OCR API and state the WeChat support boundary", async () => {
  const sources = await Promise.all(["vanilla/main.ts", "react/App.tsx", "vite/main.ts", "cdn/index.html", "wechat-web-view/index.html"].map((file) => readFile(`examples/${file}`, "utf8")));
  for (const source of sources) assert.match(source, /createOCR/);
  const wechat = `${sources.at(-1)}\n${await readFile("examples/wechat-web-view/README.md", "utf8")}`;
  assert.match(wechat, /web-view/i);
  assert.match(wechat, /(原生小程序.*不支持|native mini-program runtime.*not supported)/i);
});
