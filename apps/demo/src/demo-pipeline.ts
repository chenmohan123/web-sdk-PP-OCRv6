import { createDetector, createOCR, createRecognizer, type OCRPipeline, type OCRResult, type RuntimeOptions } from "web-sdk-pp-ocrv6";

export type Mode = "ocr" | "detection" | "recognition";

export function createDemoPipeline(options: RuntimeOptions, mode: Mode): OCRPipeline {
  if (mode === "ocr") return createOCR(options);
  const component = mode === "detection" ? createDetector(options) : createRecognizer(options);
  const run: OCRPipeline["ocr"] = async (input, runOptions): Promise<OCRResult> => {
    if (component.kind === "detector") {
      const result = await component.detect(input, runOptions);
      return { ...result, lines: result.detections.map((line) => ({ ...line, text: "", recognitionScore: 0 })), stageTimings: { detectionMs: result.timings.totalMs, cropMs: 0, recognitionMs: 0 } };
    }
    const decodeStarted = performance.now();
    let raster = input;
    if (input instanceof Blob) {
      const bitmap = await createImageBitmap(input);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法创建图像绘图区");
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
        raster = { width: pixels.width, height: pixels.height, data: pixels.data, source: "image" };
      } finally { bitmap.close(); }
    }
    const decodeMs = performance.now() - decodeStarted;
    const result = await component.recognize(raster, runOptions);
    const polygon = [{ x: 0, y: 0 }, { x: result.image.width, y: 0 }, { x: result.image.width, y: result.image.height }, { x: 0, y: result.image.height }];
    return { ...result, timings: { ...result.timings, decodeMs, totalMs: result.timings.totalMs + decodeMs }, detections: [], lines: result.recognitions.map((line) => ({ ...line, recognitionScore: line.score, polygon })), stageTimings: { detectionMs: 0, cropMs: 0, recognitionMs: result.timings.totalMs } };
  };
  return { kind: "ocr", load: () => component.load(), dispose: () => component.dispose(), ocr: run, recognize: run };
}
