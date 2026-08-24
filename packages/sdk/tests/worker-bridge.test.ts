import { describe, expect, it, vi } from "vitest";
import { createWorkerBridge } from "../src/runtime/worker-bridge";

class FakeWorker extends EventTarget {
  sent: Array<{ message: unknown; transfer: Transferable[] | undefined }> = [];
  postMessage(message: unknown, transfer?: Transferable[]) { this.sent.push({ message, transfer }); }
  terminate = vi.fn();
  respond(data: unknown) { this.dispatchEvent(new MessageEvent("message", { data })); }
  fail(error: Error) {
    const event = new Event("error") as Event & { error?: Error; message?: string };
    event.error = error;
    event.message = error.message;
    this.dispatchEvent(event);
  }
}

describe("worker bridge", () => {
  it("transfers model and input buffers and resolves protocol responses", async () => {
    const worker = new FakeWorker();
    const bridge = createWorkerBridge(worker);
    const load = bridge.load(new Uint8Array([1, 2]).buffer);
    const loadMessage = worker.sent[0]!.message as { requestId: string; type: string };
    worker.respond({ type: "result", requestId: loadMessage.requestId, result: { ok: true } });
    await expect(load).resolves.toEqual({ ok: true });

    const input = new Float32Array([1, 2]);
    const run = bridge.run(input.buffer);
    const runMessage = worker.sent[1]!.message as { requestId: string; type: string };
    expect(runMessage.type).toBe("run");
    expect(worker.sent[1]!.transfer).toContain(input.buffer);
    worker.respond({ type: "result", requestId: runMessage.requestId, result: { output: new Float32Array([3]).buffer } });
    await expect(run).resolves.toMatchObject({ output: expect.any(ArrayBuffer) });
    await bridge.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects pending requests on worker errors and propagates abort", async () => {
    const worker = new FakeWorker();
    const bridge = createWorkerBridge(worker);
    const pending = bridge.run(new ArrayBuffer(1));
    worker.fail(new Error("worker crashed"));
    await expect(pending).rejects.toMatchObject({ code: "INFERENCE_FAILED" });
    const controller = new AbortController();
    const aborted = bridge.run(new ArrayBuffer(1), controller.signal);
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ code: "ABORTED" });
  });
});
