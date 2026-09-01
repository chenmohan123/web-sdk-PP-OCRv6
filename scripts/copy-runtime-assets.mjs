import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const destination = resolve(root, "packages/sdk/dist/models");
await rm(destination, { recursive: true, force: true });
await mkdir(resolve(destination, "dictionaries"), { recursive: true });
await cp(resolve(root, "models/pp-ocrv6/manifest.json"), resolve(destination, "manifest.json"));
await cp(resolve(root, "models/pp-ocrv6/dictionaries"), resolve(destination, "dictionaries"), { recursive: true });
console.log("Copied runtime manifest and dictionaries; ONNX assets remain release-only.");
