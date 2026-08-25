import { describe, expect, it } from "vitest";
import { overlayStrokeWidth } from "./overlayStroke";

describe("overlay stroke width", () => {
  it("keeps the normal green box at 1.5 screen pixels while zooming", () => {
    expect(overlayStrokeWidth(1, false)).toBeCloseTo(1.5);
    expect(overlayStrokeWidth(2.4, false) * 2.4).toBeCloseTo(1.5);
  });

  it("keeps the selected orange box at 2 screen pixels while zooming", () => {
    expect(overlayStrokeWidth(1, true)).toBeCloseTo(2);
    expect(overlayStrokeWidth(2.4, true) * 2.4).toBeCloseTo(2);
  });
});
