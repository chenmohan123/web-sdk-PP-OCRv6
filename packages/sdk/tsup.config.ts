import { defineConfig } from "tsup";

export default defineConfig([
  { entry: { index: "src/index.ts" }, outDir: "dist", clean: true, dts: true, format: ["esm"], platform: "browser", sourcemap: true, target: "es2022", external: [/^onnxruntime-web/] },
  { entry: { "inference.worker": "src/inference.worker.ts" }, outDir: "dist", clean: false, format: ["esm"], platform: "browser", sourcemap: true, target: "es2022" }
]);
