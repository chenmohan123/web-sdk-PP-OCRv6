import { describe, expect, it } from "vitest";
import { postprocessDetection } from "../src/detector/postprocess";
import { sortDetectionsReadingOrder } from "../src/detector/reading-order";

describe("DB detection postprocessing", () => {
  it("restores thresholded components to clipped original-pixel polygons", () => {
    const map = new Float32Array([
      0, 0, 0, 0,
      0, 0.9, 0.8, 0,
      0, 0.7, 0.9, 0,
      0, 0, 0, 0,
    ]);
    const detections = postprocessDetection({ data: map, dims: [1, 1, 4, 4] }, { originalWidth: 40, originalHeight: 20, threshold: 0.5, boxThreshold: 0.6, unclipRatio: 1, minSize: 1 });
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({ index: 0 });
    expect(detections[0]!.score).toBeCloseTo(0.825, 3);
    expect(detections[0]!.polygon).toEqual([{ x: 10, y: 5 }, { x: 30, y: 5 }, { x: 30, y: 15 }, { x: 10, y: 15 }]);
  });

  it("returns empty output below box threshold and keeps stable reading-order indices", () => {
    expect(postprocessDetection({ data: new Float32Array(16).fill(0.3), dims: [1, 1, 4, 4] }, { originalWidth: 4, originalHeight: 4, threshold: 0.2, boxThreshold: 0.5, unclipRatio: 1, minSize: 1 })).toEqual([]);
    const sorted = sortDetectionsReadingOrder([
      { index: 7, score: 1, polygon: [{ x: 30, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 30 }, { x: 30, y: 30 }] },
      { index: 3, score: 1, polygon: [{ x: 20, y: 2 }, { x: 30, y: 2 }, { x: 30, y: 12 }, { x: 20, y: 12 }] },
      { index: 5, score: 1, polygon: [{ x: 1, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 11 }, { x: 1, y: 11 }] },
    ]);
    expect(sorted.map((item) => item.index)).toEqual([5, 3, 7]);
  });
});
