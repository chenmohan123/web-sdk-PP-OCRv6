import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");
test("CI, Pages, and release workflows use least privilege and immutable tags", async () => {
  const ci = await read(".github/workflows/ci.yml");
  const pages = await read(".github/workflows/pages.yml");
  const release = await read(".github/workflows/release.yml");
  assert.match(ci, /permissions:\s*\n\s+contents: read/);
  assert.match(ci, /pnpm verify/);
  assert.match(pages, /environment:\s*\n\s+name: github-pages/);
  assert.match(pages, /pages: write/);
  assert.match(pages, /id-token: write/);
  assert.match(pages, /concurrency:/);
  assert.match(pages, /mkdir -p apps\/demo\/dist\/models\/pp-ocrv6/);
  assert.match(pages, /cp -R models\/pp-ocrv6\/. apps\/demo\/dist\/models\/pp-ocrv6\//);
  assert.match(release, /tags:\s*\n\s+- "v\*"/);
  assert.match(release, /npm publish --access public --provenance/);
  assert.match(release, /gh release create/);
  assert.doesNotMatch(release, /NPM_TOKEN|NODE_AUTH_TOKEN|_authToken/);
});

test("release metadata states model provenance, defaults, backends, and limits", async () => {
  const changelog = await read("CHANGELOG.md");
  for (const value of ["PaddlePaddle", "Apache-2.0", "small-det", "small-rec", "WASM", "WebGPU", "native mini-program"]) assert.match(changelog, new RegExp(value, "i"));
});
