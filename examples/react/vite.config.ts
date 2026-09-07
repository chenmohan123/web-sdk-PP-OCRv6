import { createReadStream, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("web-sdk-pp-ocrv6"));
const ortDist = dirname(sdkRequire.resolve("onnxruntime-web"));
const assets = readdirSync(ortDist).filter((file) => /^ort-wasm.*\.(mjs|wasm)$/.test(file));

export default defineConfig({
  base: "./",
  // 已发布 SDK 的相对 Worker 路径交由 Vite 处理，避免预构建改写路径。
  optimizeDeps: { exclude: ["web-sdk-pp-ocrv6"] },
  plugins: [{
    name: "ort-assets",
    generateBundle() {
      for (const file of assets) this.emitFile({ type: "asset", fileName: `ort/${file}`, source: readFileSync(join(ortDist, file)) });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        if (!path.startsWith("/ort/")) return next();
        const file = path.slice("/ort/".length);
        if (!assets.includes(file)) { response.statusCode = 404; response.end(); return; }
        response.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        createReadStream(join(ortDist, file)).on("error", next).pipe(response);
      });
    },
  }],
});
