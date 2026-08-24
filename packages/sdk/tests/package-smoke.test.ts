import { describe, expect, it } from "vitest";
import { PPOCRv6Error, createDetector, probeCapabilities } from "../src/index";

describe("public package scaffold", () => {
  it("exports capability probing", () => expect(probeCapabilities()).toHaveProperty("wasm"));
  it("fails factories with the stable manifest error until configured", () => {
    expect(() => createDetector()).toThrowError(PPOCRv6Error);
    try { createDetector(); } catch (error) { expect((error as PPOCRv6Error).code).toBe("INVALID_MANIFEST"); }
  });
});
