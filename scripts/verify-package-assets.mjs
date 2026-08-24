import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: resolve(root, "packages/sdk"), encoding: "utf8", shell: process.platform === "win32" });
const metadata = JSON.parse(output)[0];
const files = metadata.files.map((entry) => entry.path);
for (const required of ["dist/index.js", "dist/index.d.ts", "dist/inference.worker.js", "dist/models/manifest.json"]) if (!files.includes(required)) throw new Error(`Package is missing ${required}`);
if (!files.some((file) => file.startsWith("dist/models/dictionaries/") && file.endsWith(".txt"))) throw new Error("Package is missing recognition dictionaries");
if (files.some((file) => file.endsWith(".onnx"))) throw new Error("npm package must not contain ONNX files");
const packageMetadata = JSON.parse(readFileSync(resolve(root, "packages/sdk/package.json"), "utf8"));
if (packageMetadata.publishConfig?.provenance !== true) throw new Error("npm provenance must be enabled");
console.log(`Package verified: ${files.length} files, no ONNX assets.`);
