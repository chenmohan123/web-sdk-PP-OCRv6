import { createOCR } from "web-sdk-pp-ocrv6";
const input = document.querySelector<HTMLInputElement>("#file")!;
document.querySelector("#run")!.addEventListener("click", async () => {
  const file = input.files?.[0]; if (!file) return;
  const createOCRRuntime = createOCR;
  const ocr = createOCRRuntime({ backend: "wasm", execution: "worker", model: { det: "small", rec: "small" } });
  try { document.querySelector("#result")!.textContent = (await ocr.ocr(file)).lines.map((line) => line.text).join("\n"); } finally { await ocr.dispose(); }
});
