import * as ort from "onnxruntime-web";
import { createOCR } from "web-sdk-pp-ocrv6";

export const modelSources = {
  modelscope: "https://modelscope.cn/models/chenmohan/web-sdk-pp-ocrv6/resolve/master/manifest.json?v=1.0.0",
  huggingface: "https://huggingface.co/chenmohan/web-sdk-pp-ocrv6/resolve/main/manifest.json?v=1.0.0",
};

export function createExampleRunner(render) {
  let closed = false;
  let busy = false;
  let active;
  let controller;
  let task;
  const update = (message) => { if (!closed) render({ busy, message }); };
  return {
    run(file, source = "modelscope") {
      if (closed || busy) return Promise.resolve();
      busy = true;
      controller = new AbortController();
      const signal = controller.signal;
      task = (async () => {
        let message = "已取消";
        try {
          update("正在下载并初始化模型");
          const selection = { manifestUrl: modelSources[source], preset: "tiny" };
          ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
          const ocr = createOCR({ model: { det: selection, rec: selection }, backend: "wasm", execution: "main", allowFallback: false });
          active = ocr;
          // 通过 ocr 懒加载并执行 DET/REC。
          const result = await ocr.ocr(file, { signal });
          message = JSON.stringify(result, null, 2);
        } catch (error) {
          const value = error;
          message = signal.aborted ? "已取消" : `${value.code ?? "OCR_FAILED"}: ${value.message ?? String(error)}`;
        } finally {
          try { await active?.dispose(); }
          catch (error) { message = `释放失败: ${String(error)}`; }
          active = undefined;
          busy = false;
          if (!signal.aborted) update(message);
          else update("已取消");
        }
      })();
      return task;
    },
    cancel() { controller?.abort(); },
    async dispose() {
      closed = true;
      controller?.abort();
      // 等待任务收尾，由 finally 统一释放会话。
      await task;
    },
  };
}
