import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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


test("版本守卫允许清单字段排序、引号和 JSX 换行，仍拒绝版本不一致", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "ocrv6-release-contract-"));
  const paths = ["scripts/verify-release.mjs", "package.json", "packages/sdk/package.json", "sdk-manifest.yaml", "apps/demo/src/App.tsx", "CHANGELOG.md", ".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/release.yml"];
  try {
    for (const path of paths) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await cp(path, join(fixture, path));
    }
    const { version } = JSON.parse(await read("packages/sdk/package.json"));
    const run = (tag = "v" + version) => spawnSync(process.execPath, [join(fixture, "scripts/verify-release.mjs"), tag], { encoding: "utf8" });
    const originalManifest = await read("sdk-manifest.yaml");
    const originalDemo = await read("apps/demo/src/App.tsx");
    await writeFile(join(fixture, "apps/demo/src/App.tsx"), originalDemo.replace("<span>v" + version + "</span>", "<span>\n  v" + version + "\n</span>"));
    for (const value of [version, "'" + version + "'", '"' + version + '"']) {
      await writeFile(join(fixture, "sdk-manifest.yaml"), originalManifest.replace(/package:[\s\S]*?(?=^repository:)/m, "package:\n  version: " + value + " # 包版本\n  name: web-sdk-pp-ocrv6\n"));
      const result = run();
      assert.equal(result.status, 0, result.stderr);
    }
    const wrongTag = run("v0.0.0");
    assert.notEqual(wrongTag.status, 0);
    assert.match(wrongTag.stderr, /版本|version/);
    for (const [path, original, invalid, error] of [
      ["sdk-manifest.yaml", originalManifest, originalManifest.replace('version: "' + version + '"', 'version: "0.0.0"'), /manifest/],
      ["apps/demo/src/App.tsx", originalDemo, originalDemo.replace("<span>v" + version + "</span>", "<span>v0.0.0</span>"), /Demo/],
      ["package.json", await read("package.json"), (await read("package.json")).replace('"version": "' + version + '"', '"version": "0.0.0"'), /工作区/],
    ]) {
      await writeFile(join(fixture, path), invalid);
      const result = run();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, error);
      await writeFile(join(fixture, path), original);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
