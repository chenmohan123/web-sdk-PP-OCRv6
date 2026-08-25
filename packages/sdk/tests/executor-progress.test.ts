import { describe, expect, it, vi } from "vitest";
import { createInferenceExecutor } from "../src/runtime/executor";

class FakeWorker extends EventTarget {
  readonly sent: unknown[] = [];
  postMessage(message: unknown) {
    this.sent.push(message);
    const value = message as { type?: string; requestId?: string };
    if (value.type === "load") {
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "progress", requestId: value.requestId, phase: "session", progress: 0 } })));
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "progress", requestId: value.requestId, phase: "session", progress: 1 } })));
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "result", requestId: value.requestId, result: { sessionMs: 2 } } })));
    }
  }
  terminate() {}
}

describe("inference executor progress", () => {
  it("forwards worker session progress to the public executor callback", async () => {
    const progress = vi.fn();
    const executor = await createInferenceExecutor({ model: new Uint8Array([1]).buffer as never, backend: "wasm", execution: "worker", workerFactory: () => new FakeWorker() as never, onProgress: progress });
    expect(progress).toHaveBeenNthCalledWith(1, { phase: "session", progress: 0 });
    expect(progress).toHaveBeenNthCalledWith(2, { phase: "session", progress: 1 });
    await executor.dispose();
  });
});
