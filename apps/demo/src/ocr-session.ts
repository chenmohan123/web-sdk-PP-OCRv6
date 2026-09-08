import type { OCRPipeline, RuntimeOptions } from "web-sdk-pp-ocrv6";

type OCRFactory = (options: RuntimeOptions, mode: "ocr" | "detection" | "recognition") => OCRPipeline;

export function createOCRSessionManager(factory: OCRFactory) {
  let current: { key: string; ocr: OCRPipeline } | undefined;
  let tail = Promise.resolve();
  let generation = 0;
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const pending = tail.then(action);
    tail = pending.then(() => undefined, () => undefined);
    return pending;
  };

  return {
    ensure(key: string, options: RuntimeOptions, mode: "ocr" | "detection" | "recognition" = "ocr"): Promise<{ ocr: OCRPipeline; reused: boolean; loadMs: number }> {
      const started = generation;
      return enqueue(async () => {
      if (current?.key === key) return { ocr: current.ocr, reused: true, loadMs: 0 };

      if (current) {
        const previous = current;
        current = undefined;
        await previous.ocr.dispose();
      }

      const ocr = factory(options, mode);
      const loadStarted = performance.now();
      try {
        await ocr.load();
        if (generation !== started) throw new DOMException("会话初始化已取消", "AbortError");
      } catch (error) {
        await ocr.dispose();
        throw error;
      }
      current = { key, ocr };
      return { ocr, reused: false, loadMs: performance.now() - loadStarted };
      });
    },

    dispose(): Promise<void> {
      generation += 1;
      return enqueue(async () => {
        const active = current;
        current = undefined;
        await active?.ocr.dispose();
      });
    },
  };
}
