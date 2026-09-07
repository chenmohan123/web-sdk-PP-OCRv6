import { createExampleRunner } from "./runner";
const input = document.querySelector<HTMLInputElement>("#image")!;
const source = document.querySelector<HTMLSelectElement>("#source")!;
const run = document.querySelector<HTMLButtonElement>("#run")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
const runner = createExampleRunner(({ busy, message }) => {
  run.disabled = busy; input.disabled = busy; source.disabled = busy;
  output.textContent = message;
});
run.addEventListener("click", () => { const file = input.files?.[0]; if (file) void runner.run(file, source.value as "modelscope" | "huggingface"); });
document.querySelector("#cancel")!.addEventListener("click", () => runner.cancel());
window.addEventListener("pagehide", () => { void runner.dispose(); }, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { void runner.dispose(); });
