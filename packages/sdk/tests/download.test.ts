import { describe, expect, it, vi } from "vitest";
import { downloadModel } from "../src/model/download";
import type { OCRProgress } from "../src/types";

const request = { url: "https://cdn.test/model.onnx", bytes: 4, sha256: "a".repeat(64) };

describe("model download progress", () => {
  it("reports byte progress while reading a response stream", async () => {
    const progress: unknown[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const result = await downloadModel(request, {
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200, body } as Response),
      hash: vi.fn().mockResolvedValue(request.sha256),
      onProgress: (event: OCRProgress) => progress.push(event),
    } as never);
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(progress).toEqual([
      expect.objectContaining({ phase: "download", progress: 0, loadedBytes: 0, totalBytes: 4 }),
      expect.objectContaining({ phase: "download", progress: 0.5, loadedBytes: 2, totalBytes: 4 }),
      expect.objectContaining({ phase: "download", progress: 1, loadedBytes: 4, totalBytes: 4 }),
      expect.objectContaining({ phase: "integrity", progress: 0 }),
      expect.objectContaining({ phase: "integrity", progress: 1 }),
    ]);
  });

  it("falls back to arrayBuffer when a response has no stream body", async () => {
    const progress: unknown[] = [];
    await downloadModel(request, {
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200, body: null, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer } as Response),
      hash: vi.fn().mockResolvedValue(request.sha256),
      onProgress: (event: OCRProgress) => progress.push(event),
    } as never);
    expect(progress).toEqual([
      expect.objectContaining({ phase: "download" }),
      expect.objectContaining({ phase: "integrity", progress: 0 }),
      expect.objectContaining({ phase: "integrity", progress: 1 }),
    ]);
    expect(progress.filter((event) => (event as { phase?: string }).phase === "download").some((event) => typeof (event as { progress?: number }).progress === "number")).toBe(false);
  });
});
