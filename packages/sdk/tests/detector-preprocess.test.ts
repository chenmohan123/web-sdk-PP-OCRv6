import { describe, expect, it } from "vitest";
import { decodeImage } from "../src/detector/decode";
import { preprocessDetection } from "../src/detector/preprocess";

describe("detector image preprocessing", () => {
  it("accepts ImageData-shaped raster input and converts RGBA to normalized BGR NCHW", async () => {
    const image = await decodeImage({ width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]) });
    const result = preprocessDetection(image, { width: 2, height: 1, scale: 1 / 255, mean: [0, 0, 0], std: [1, 1, 1] });
    expect(result.dims).toEqual([1, 3, 1, 2]);
    expect(Array.from(result.data)).toEqual([0, 0, 0, 1, 1, 0]);
    expect(result.originalWidth).toBe(2);
  });

  it("rejects empty or unsupported image inputs with INVALID_INPUT", async () => {
    await expect(decodeImage({ width: 0, height: 1, data: new Uint8ClampedArray() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(decodeImage(42)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
