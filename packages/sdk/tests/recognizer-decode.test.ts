import { describe, expect, it } from "vitest";
import { decodeCTC, decodeNRTR } from "../src/recognizer/decode";

describe("recognition decoders", () => {
  it("collapses CTC repeats and blanks and averages selected confidence", () => {
    const probabilities = new Float32Array([
      0.05, 0.9, 0.05,
      0.05, 0.8, 0.15,
      0.9, 0.05, 0.05,
      0.05, 0.1, 0.85,
    ]);
    const [result] = decodeCTC(probabilities, [1, 4, 3], ["你", "好"], { blankIndex: 0, probabilities: true });
    expect(result).toMatchObject({ text: "你好" });
    expect(result!.score).toBeCloseTo(0.875, 3);
  });

  it("stops NRTR output at EOS and skips control tokens", () => {
    const [result] = decodeNRTR(new Int32Array([0, 3, 4, 1, 4]), [1, 5], ["你", "好"], { bosIndex: 0, eosIndex: 1, padIndex: 2, tokenOffset: 3 });
    expect(result).toEqual({ text: "你好", score: 1 });
  });
});
