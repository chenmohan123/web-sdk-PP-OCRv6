import { describe, expect, it, vi } from "vitest";
import { createProgressReporter } from "../src/progress";

describe("progress reporter", () => {
  it("isolates callback failures and reports a single network download", () => {
    const callback = vi.fn(() => { throw new Error("consumer failed"); });
    const reporter = createProgressReporter(callback, ["det"]);
    reporter.register("det", 4);
    reporter.markSource("det", "network");

    expect(() => reporter.emit("det", { phase: "download", progress: 0, loadedBytes: 0, totalBytes: 4 })).not.toThrow();
    reporter.emit("det", { phase: "download", progress: 0.5, loadedBytes: 2, totalBytes: 4 });
    reporter.emit("det", { phase: "download", progress: 1, loadedBytes: 4, totalBytes: 4 });
    expect(callback).toHaveBeenLastCalledWith({ phase: "download", progress: 1, loadedBytes: 4, totalBytes: 4 });
  });

  it("aggregates only network components when the other model is cached", () => {
    const events: unknown[] = [];
    const reporter = createProgressReporter((event) => events.push(event), ["det", "rec"]);
    reporter.register("det", 25);
    reporter.register("rec", 75);
    reporter.markSource("det", "cache");
    reporter.markSource("rec", "network");
    reporter.emit("det", { phase: "cache", progress: 1 });
    reporter.emit("rec", { phase: "download", progress: 0.5, loadedBytes: 37, totalBytes: 75 });
    expect(events.at(-1)).toEqual({ phase: "download", progress: 37 / 75, loadedBytes: 37, totalBytes: 75 });
  });

  it("weights two network components by their declared bytes", () => {
    const events: unknown[] = [];
    const reporter = createProgressReporter((event) => events.push(event), ["det", "rec"]);
    reporter.register("det", 25);
    reporter.register("rec", 75);
    reporter.markSource("det", "network");
    reporter.markSource("rec", "network");
    reporter.emit("det", { phase: "download", progress: 1, loadedBytes: 25, totalBytes: 25 });
    reporter.emit("rec", { phase: "download", progress: 0.5, loadedBytes: 37, totalBytes: 75 });
    expect(events.at(-1)).toEqual({ phase: "download", progress: 0.62, loadedBytes: 62, totalBytes: 100 });
  });
});
