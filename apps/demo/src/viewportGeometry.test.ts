import { describe, expect, it } from "vitest";
import { clampOffset, fitScale, zoomAroundPoint } from "./viewportGeometry";

describe("image viewport geometry", () => {
  const image = { width: 820, height: 1024 };
  const viewport = { width: 640, height: 420 };

  it("fits the whole image into the viewport", () => {
    expect(fitScale(image, viewport)).toBeCloseTo(420 / 1024, 5);
  });

  it("keeps the scaled image covering the viewport", () => {
    expect(clampOffset({ x: 9999, y: -9999 }, 1, image, viewport)).toEqual({ x: 90, y: -302 });
  });

  it("keeps the pointer anchored while zooming", () => {
    const next = zoomAroundPoint({ x: 0, y: 0 }, 0.5, 1, { x: 40, y: 30 }, image, viewport);
    expect(next.offset.x).toBeCloseTo(-40);
    expect(next.offset.y).toBeCloseTo(-30);
  });
});
