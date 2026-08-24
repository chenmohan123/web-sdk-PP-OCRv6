import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageMetadata = JSON.parse(readFileSync(resolve(root, "packages/sdk/package.json"), "utf8"));
const tag = process.argv[2];
if (tag !== undefined && tag !== `v${packageMetadata.version}`) throw new Error(`Tag ${tag} must match package version ${packageMetadata.version}`);
for (const path of [".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/release.yml", "CHANGELOG.md"]) readFileSync(resolve(root, path));
console.log(`Release ${tag ?? `v${packageMetadata.version}`} is locally valid.`);
