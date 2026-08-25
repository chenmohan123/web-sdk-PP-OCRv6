const NORMAL_STROKE_SCREEN_PX = 1.5;
const SELECTED_STROKE_SCREEN_PX = 2;

/** Returns the canvas-space width needed to keep the overlay visually thin at any zoom. */
export function overlayStrokeWidth(scale: number, selected: boolean): number {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return (selected ? SELECTED_STROKE_SCREEN_PX : NORMAL_STROKE_SCREEN_PX) / safeScale;
}
