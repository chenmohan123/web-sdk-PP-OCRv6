import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageMetadata = JSON.parse(readFileSync(resolve(root, "packages/sdk/package.json"), "utf8"));
const workspaceMetadata = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
if (workspaceMetadata.version !== packageMetadata.version) throw new Error("根工作区与 SDK 包版本必须一致");
const manifest = readFileSync(resolve(root, "sdk-manifest.yaml"), "utf8");
// 这里只校验 package 块的版本标量；完整 YAML 与 schema 校验由门户 sdk:check 负责。
const packageBlock = manifest.match(/^package:[ \t]*(?:#.*)?\r?\n((?:[ \t]+[^\r\n]*\r?\n|\r?\n)*)/m)?.[1];
const versionScalar = packageBlock?.match(/^[ \t]+version:[ \t]*(?:"([^"]+)"|'([^']+)'|([^\s#]+))[ \t]*(?:#.*)?$/m);
const manifestVersion = versionScalar?.[1] ?? versionScalar?.[2] ?? versionScalar?.[3];
if (manifestVersion !== packageMetadata.version) throw new Error("SDK manifest 与 npm 包版本必须一致");
const demo = readFileSync(resolve(root, "apps/demo/src/App.tsx"), "utf8");
const demoVersions = [...demo.matchAll(/<span>\s*(v[^\s<]+)\s*<\/span>/g)].map((match) => match[1]);
if (!demoVersions.includes(`v${packageMetadata.version}`)) throw new Error("Demo 显示版本必须与 SDK 一致");
if (!readFileSync(resolve(root, "CHANGELOG.md"), "utf8").includes(`## ${packageMetadata.version} - `)) throw new Error("CHANGELOG 缺少当前版本记录");
const tag = process.argv[2];
if (tag !== undefined && tag !== `v${packageMetadata.version}`) throw new Error(`标签 ${tag} 必须与包版本 ${packageMetadata.version} 一致`);
for (const path of [".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/release.yml", "CHANGELOG.md"]) readFileSync(resolve(root, path));
console.log(`发布 ${tag ?? `v${packageMetadata.version}`} 的本地静态校验通过。`);
