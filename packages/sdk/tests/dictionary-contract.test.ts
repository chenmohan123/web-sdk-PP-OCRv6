import { describe, expect, it } from "vitest";
import { PPOCRv6Error } from "../src/errors";
import { validateRecognitionDictionary } from "../src/recognizer/dictionary";

const asset = {
  id: "PP-OCRv6_test_rec",
  role: "rec" as const,
  bytes: 4,
  sha256: "a".repeat(64),
  url: "https://cdn.test/model.onnx",
  input: { name: "x", dtype: "float32", shape: ["N", 3, 48, "W"] },
  output: { name: "y", dtype: "float32", shape: ["N", "T", 4] },
  preprocessing: { resize: { height: 48, width: 320 } },
  decoder: { name: "CTCLabelDecode", blankIndex: 0, dictionaryEntries: 3 },
};

describe("recognition dictionary contract", () => {
  it("accepts a dictionary with one entry for every non-blank output class", () => {
    expect(validateRecognitionDictionary(asset, ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("rejects a dictionary whose length is shifted from the output classes", () => {
    expect(() => validateRecognitionDictionary(asset, ["a", "b"])).toThrow(PPOCRv6Error);
    expect(() => validateRecognitionDictionary(asset, ["a", "b"])).toThrow(/PP-OCRv6_test_rec.*2.*3/);
  });

  it("rejects a dictionary that disagrees with the manifest declaration", () => {
    expect(() => validateRecognitionDictionary({ ...asset, decoder: { ...asset.decoder, dictionaryEntries: 4 } }, ["a", "b", "c"])).toThrow(/dictionaryEntries/);
  });
});
