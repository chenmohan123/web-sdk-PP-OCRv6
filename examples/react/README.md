# React example

Run from the repository root: `pnpm install && pnpm exec vite examples/react`. Install the package in another React project with `pnpm add web-sdk-pp-ocrv6@0.1.1`.

The component creates one OCR instance per run and disposes it in `finally`; production apps can retain one loaded instance for warm runs.
