import react from "@vitejs/plugin-react";
import { createReadStream, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig, type Plugin } from "vite";

const ortAssetNames = new Set([
  "ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jspi.mjs", "ort-wasm-simd-threaded.jspi.wasm",
  "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"
]);

function ortAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const sdkRequire = createRequire(require.resolve("web-sdk-pp-ocrv6"));
  const ortDist = dirname(sdkRequire.resolve("onnxruntime-web"));
  let prefix = "/ort/";
  return {
    name: "ort-assets",
    configResolved(config) { prefix = new URL(`${config.base}ort/`, "http://localhost").pathname; },
    generateBundle() {
      // 开发和生产均使用 SDK 依赖的同版本运行时资源。
      for (const filename of ortAssetNames) this.emitFile({ type: "asset", fileName: `ort/${filename}`, source: readFileSync(join(ortDist, filename)) });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (!pathname.startsWith(prefix)) { next(); return; }
        const filename = decodeURIComponent(pathname.slice(prefix.length));
        if (!ortAssetNames.has(filename)) { response.statusCode = 404; response.end(); return; }
        response.setHeader("Content-Type", filename.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        createReadStream(join(ortDist, filename)).on("error", next).pipe(response);
      });
    }
  };
}

export default defineConfig({ base: "./", plugins: [ortAssets(), react()], server: { host: "127.0.0.1", port: 4173 } });
