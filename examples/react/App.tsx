import { useState } from "react";
import { createOCR, type OCRResult } from "web-sdk-pp-ocrv6";

export function App() {
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<OCRResult>();
  const run = async () => {
    if (!file) return;
    const ocr = createOCR({ model: { det: "small", rec: "small" }, backend: "wasm", execution: "worker", allowFallback: false });
    try { setResult(await ocr.ocr(file)); } finally { await ocr.dispose(); }
  };
  return <main><h1>PP-OCRv6 React</h1><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0])}/><button onClick={() => void run()}>OCR</button><pre>{result ? JSON.stringify(result, null, 2) : "Choose an image"}</pre></main>;
}
