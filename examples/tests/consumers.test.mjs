import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const destination = await mkdtemp(join(tmpdir(), "ocrv6-consumers-"));
const tarball = process.argv[2] ? resolve(process.argv[2]) : undefined;
const candidate = JSON.parse(await readFile(join(root, "packages/sdk/package.json"), "utf8"));
const expectedVersion = tarball ? candidate.version : "0.1.8";
if (tarball) await readFile(tarball);
function command(cwd, args) {
  return new Promise((done, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, { cwd, shell: process.platform === "win32", stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? done() : reject(new Error(`${cwd}: npm ${args.join(" ")} 退出 ${code}`)));
  });
}
for (const name of ["vanilla", "react", "vite"]) {
  const directory = join(destination, name);
  await cp(join(root, "examples", name), directory, { recursive: true, filter: (path) => !/[\\/](node_modules|dist)([\\/]|$)/.test(path) });
  if (tarball) {
    const path = join(directory, "package.json");
    const pkg = JSON.parse(await readFile(path, "utf8"));
    pkg.dependencies["web-sdk-pp-ocrv6"] = `file:${tarball.replaceAll("\\", "/")}`;
    await writeFile(path, JSON.stringify(pkg, null, 2) + "\n");
    if (name === "vanilla") {
      await cp(join(root, "examples/tests/candidate-runtime.ts"), join(directory, "candidate-runtime.ts"));
      await writeFile(join(directory, "candidate.html"), '<!doctype html><html lang="zh-CN"><title>候选包验证</title><script type="module" src="./candidate-runtime.ts"></script></html>');
      const configPath = join(directory, "vite.config.ts");
      const config = await readFile(configPath, "utf8");
      assert.ok(config.includes("defineConfig({"));
      await writeFile(configPath, config.replace("defineConfig({", 'defineConfig({ build: { rollupOptions: { input: ["index.html", "candidate.html"] } },'));
    }
  }
  await command(directory, ["install", "--no-audit", "--no-fund"]);
  const installed = JSON.parse(await readFile(join(directory, "node_modules/web-sdk-pp-ocrv6/package.json"), "utf8"));
  assert.equal(installed.version, expectedVersion);
  await command(directory, ["run", "build"]);
  assert.match(await readFile(join(directory, "dist/index.html"), "utf8"), /assets/);
  assert.deepEqual([...new Uint8Array(await readFile(join(directory, "dist/ort/ort-wasm-simd-threaded.wasm"))).slice(0, 4)], [0, 97, 115, 109]);
}
console.log(`三个独立消费者 ${expectedVersion} 安装和构建通过：${destination}`);
