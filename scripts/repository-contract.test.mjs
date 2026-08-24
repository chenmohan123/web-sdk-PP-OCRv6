import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("repository exposes a public semver package contract", async () => {
  const rootPkg = await readJson("package.json");
  const pkg = await readJson("packages/sdk/package.json");
  assert.equal(pkg.name, "web-sdk-pp-ocrv6");
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(rootPkg.private, true);
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.repository?.url, "https://github.com/chenmohan123/web-sdk-PP-OCRv6.git");
  assert.equal(pkg.publishConfig.access, "public");
  assert.ok(pkg.exports["."]);
});

test("repository has reciprocal readmes, source entry, and demo entry", async () => {
  const [readme, readmeEn] = await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("README.en.md", root), "utf8")
  ]);
  assert.match(readme, /README\.en\.md/);
  assert.match(readmeEn, /README\.md/);
  await readFile(new URL("packages/sdk/src/index.ts", root));
  await readFile(new URL("apps/demo/index.html", root));
});
