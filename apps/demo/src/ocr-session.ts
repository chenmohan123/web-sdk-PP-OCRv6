import type { OCRPipeline, RuntimeOptions } from "web-sdk-pp-ocrv6";

type OCRFactory = (options: RuntimeOptions) => OCRPipeline;

export function createOCRSessionManager(factory: OCRFactory) {
  let current: { key: string; ocr: OCRPipeline } | undefined;

  return {
    async ensure(key: string, options: RuntimeOptions): Promise<{ ocr: OCRPipeline; reused: boolean }> {
      if (current?.key === key) return { ocr: current.ocr, reused: true };

      if (current) {
        await current.ocr.dispose();
        current = undefined;
      }

      const ocr = factory(options);
      try {
        await ocr.load();
      } catch (error) {
        await ocr.dispose();
        throw error;
      }
      current = { key, ocr };
      return { ocr, reused: false };
    },

    async dispose(): Promise<void> {
      const active = current;
      current = undefined;
      await active?.ocr.dispose();
    },
  };
}
