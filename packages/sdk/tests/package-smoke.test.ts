import { describe, expect, it } from "vitest";
import { createDetector, createOCR, createRecognizer, probeCapabilities } from "../src/index";

describe("public package scaffold", () => {
  it("exports capability probing", () => expect(probeCapabilities()).toHaveProperty("wasm"));
  it("constructs lazy public detector, recognizer, and OCR instances", () => {
    expect(createDetector()).toMatchObject({ kind: "detector" });
    expect(createRecognizer()).toMatchObject({ kind: "recognizer" });
    expect(createOCR()).toMatchObject({ kind: "ocr" });
  });
});
