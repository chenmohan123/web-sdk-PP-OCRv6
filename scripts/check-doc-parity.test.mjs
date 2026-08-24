import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const guides = ["quick-start.md", "api.md", "models.md", "compatibility.md", "performance.md", "troubleshooting.md", "deployment.md", "privacy.md"];
test("Chinese and English public documentation stays in parity", async () => {
  assert.deepEqual((await readdir("docs/zh-CN")).filter((name) => name.endsWith(".md")).sort(), guides.slice().sort());
  assert.deepEqual((await readdir("docs/en")).filter((name) => name.endsWith(".md")).sort(), guides.slice().sort());
  for (const language of ["zh-CN", "en"]) for (const guide of guides) assert.ok((await readFile(`docs/${language}/${guide}`, "utf8")).length > 120, `${language}/${guide} is incomplete`);
});

test("READMEs expose install, repository, npm, Demo, and reciprocal language links", async () => {
  const zh = await readFile("README.md", "utf8");
  const en = await readFile("README.en.md", "utf8");
  for (const text of [zh, en]) for (const required of ["web-sdk-pp-ocrv6", "github.com/chenmohan123/web-sdk-PP-OCRv6", "npmjs.com/package/web-sdk-pp-ocrv6", "chenmohan123.github.io/web-sdk-PP-OCRv6"]) assert.match(text, new RegExp(required.replaceAll(".", "\\.")));
  assert.match(zh, /README\.en\.md/);
  assert.match(en, /README\.md/);
});
