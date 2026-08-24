import type { Detection } from "../types";

const bounds = (detection: Detection) => {
  const xs = detection.polygon.map((point) => point.x);
  const ys = detection.polygon.map((point) => point.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left: Math.min(...xs), top, height: bottom - top };
};

export function sortDetectionsReadingOrder<T extends Detection>(detections: readonly T[], toleranceRatio = 0.5): readonly T[] {
  return [...detections].sort((left, right) => {
    const a = bounds(left);
    const b = bounds(right);
    const tolerance = Math.max(1, Math.min(a.height, b.height) * toleranceRatio);
    return Math.abs(a.top - b.top) <= tolerance ? a.left - b.left : a.top - b.top;
  });
}
