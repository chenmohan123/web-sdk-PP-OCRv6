import { afterEach, expect, it, vi } from "vitest";
import { createExampleRunner } from "../vanilla/runner";

const state = vi.hoisted(() => ({ resources: 0, instances: 0, loaded: Promise.resolve(), disposed: false }));
vi.mock("../vanilla/node_modules/web-sdk-pp-ocrv6/dist/index.js", () => ({ createOCR: () => {
  state.instances += 1;
  state.disposed = false;
  return {
    async ocr() { await state.loaded; state.resources += 1; return { lines: [{ text: "A" }] }; },
    async dispose() { if (state.disposed) return; state.disposed = true; if (state.resources) state.resources -= 1; },
  };
} }));
vi.mock("onnxruntime-web", () => ({ env: { wasm: {} } }));
afterEach(() => { vi.unstubAllGlobals(); });

it("双击仅创建一个实例，卸载等待初始化再释放且不回写 UI", async () => {
  vi.stubGlobal("location", { href: "https://example.test/" });
  state.resources = 0; state.instances = 0;
  let finish!: () => void;
  state.loaded = new Promise<void>((resolve) => { finish = resolve; });
  const frames: unknown[] = [];
  const runner = createExampleRunner((frame) => frames.push(frame));
  const running = runner.run(new Blob());
  await runner.run(new Blob());
  expect(state.instances, JSON.stringify(frames)).toBe(1);
  const closing = runner.dispose();
  const frameCount = frames.length;
  finish();
  await Promise.all([closing, running]);
  expect(state.resources).toBe(0);
  expect(frames).toHaveLength(frameCount);
});
