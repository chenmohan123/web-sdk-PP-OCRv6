import { expect, it } from "vitest";
import { createCacheOperation } from "./cache-operation";

it("清理同步互斥，取消后等待任务及释放，再删除；失败后可重试", async () => {
  let finish!: () => void;
  const running = new Promise<void>((resolve) => { finish = resolve; });
  const events: string[] = [];
  const operation = createCacheOperation();
  const first = operation.run({ cancel: () => { events.push("取消"); }, wait: () => running, dispose: async () => { events.push("释放"); }, clear: async () => { events.push("删除"); throw new Error("存储失败"); } }).catch((error: unknown) => error);
  expect(operation.busy).toBe(true);
  expect(await operation.run({ cancel: () => { throw new Error("重复运行"); }, wait: async () => {}, dispose: async () => {}, clear: async () => {} })).toBe(false);
  expect(events).toEqual(["取消"]);
  finish();
  expect(await first).toBeInstanceOf(Error);
  expect(events).toEqual(["取消", "释放", "删除"]);
  expect(operation.busy).toBe(false);
  expect(await operation.run({ cancel() {}, async wait() {}, async dispose() {}, async clear() {} })).toBe(true);
});
