import { createExampleRunner } from "./runner.js";
const input = document.querySelector("#image");
const source = document.querySelector("#source");
const run = document.querySelector("#run");
const output = document.querySelector("#output");
const runner = createExampleRunner(({ busy, message }) => { run.disabled = busy; input.disabled = busy; source.disabled = busy; output.textContent = message; });
run.onclick = () => { const file = input.files?.[0]; if (file) void runner.run(file, source.value); };
document.querySelector("#cancel").onclick = () => runner.cancel();
window.addEventListener("pagehide", () => { void runner.dispose(); }, { once: true });
