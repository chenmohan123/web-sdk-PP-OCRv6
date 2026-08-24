import { describe, expect, it } from "vitest";
import { cropPolygon } from "../src/recognizer/crop";
import { preprocessRecognition } from "../src/recognizer/preprocess";

const image = { width: 2, height: 1, source: "image" as const, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]) };

describe("recognizer crop and preprocessing", () => {
  it("samples a quadrilateral crop and preserves its stable index", () => {
    const crop = cropPolygon(image, { index: 7, score: 1, polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }] });
    expect(crop.index).toBe(7);
    expect(crop.image).toMatchObject({ width: 2, height: 1 });
    expect(Array.from(crop.image.data)).toEqual(Array.from(image.data));
  });

  it("resizes with right padding and writes normalized BGR NCHW", () => {
    const tensor = preprocessRecognition(image, { height: 1, width: 4, scale: 1 / 255, mean: [0, 0, 0], std: [1, 1, 1] });
    expect(tensor.dims).toEqual([1, 3, 1, 4]);
    expect(tensor.contentWidth).toBe(2);
    expect(Array.from(tensor.data)).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0]);
  });
});
