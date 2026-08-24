import { createOCR } from "web-sdk-pp-ocrv6";

const input = document.querySelector<HTMLInputElement>("#image")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
document.querySelector("#run")!.addEventListener("click", async () => {
  const file = input.files?.[0];
  if (!file) return;
  const ocr = createOCR({ model: { det: "small", rec: "small" }, backend: "wasm", execution: "worker", allowFallback: false });
  try { output.textContent = JSON.stringify(await ocr.ocr(file), null, 2); }
  finally { await ocr.dispose(); }
});
