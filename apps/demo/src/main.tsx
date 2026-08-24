/** Minimal React entry point reserved for the full Demo implementation task. */
export function mountDemo(root: HTMLElement): void {
  root.textContent = "PP-OCRv6 Demo scaffold";
}

const root = document.getElementById("root");
if (root) mountDemo(root);
