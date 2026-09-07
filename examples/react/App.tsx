import { useEffect, useRef, useState } from "react";
import { createExampleRunner, type ExampleState } from "./runner";

export function App() {
  const [file, setFile] = useState<File>();
  const [source, setSource] = useState<"modelscope" | "huggingface">("modelscope");
  const [state, setState] = useState<ExampleState>({ busy: false, message: "请选择图片" });
  const runner = useRef<ReturnType<typeof createExampleRunner> | undefined>(undefined);
  useEffect(() => {
    const current = createExampleRunner(setState);
    runner.current = current;
    return () => { runner.current = undefined; void current.dispose(); };
  }, []);
  return <main><h1>PP-OCRv6 React</h1><p>图片在当前设备处理。首次运行会下载 tiny 模型。</p>
    <label>模型来源 <select value={source} disabled={state.busy} onChange={(event) => setSource(event.target.value as typeof source)}><option value="modelscope">ModelScope</option><option value="huggingface">Hugging Face</option></select></label>
    <label>图片 <input type="file" accept="image/*" disabled={state.busy} onChange={(event) => setFile(event.target.files?.[0])}/></label>
    <button disabled={!file || state.busy} onClick={() => { if (file) void runner.current?.run(file, source); }}>开始识别</button>
    <button onClick={() => runner.current?.cancel()}>取消</button><pre aria-live="polite">{state.message}</pre>
  </main>;
}
