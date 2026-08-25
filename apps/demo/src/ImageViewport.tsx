import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hand, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { OCRResult } from "web-sdk-pp-ocrv6";
import { clampOffset, fitScale, type ImageSize, type Offset, type ViewportSize, zoomAroundPoint } from "./viewportGeometry";
import { overlayStrokeWidth } from "./overlayStroke";

type OCRLine = OCRResult["lines"][number];

type ImageViewportCopy = Record<string, string>;

type ImageViewportProps = {
  imageUrl: string | undefined;
  imageAlt: string;
  emptyText: string;
  lines: readonly OCRLine[];
  selected: number | undefined;
  onSelect: (index: number) => void;
  copy: ImageViewportCopy;
};

type Point = Offset;
type PanSession = { kind: "pan"; pointerId: number; start: Point; startOffset: Offset };
type PinchSession = { kind: "pinch"; startDistance: number; startCenter: Point; startOffset: Offset; startScale: number };
type GestureSession = PanSession | PinchSession;

const MAX_SCALE = 2.4;
const DRAG_THRESHOLD = 3;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const isEditableTarget = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName));

export function ImageViewport({ imageUrl, imageAlt, emptyText, lines, selected, onSelect, copy }: ImageViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportCanvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<GestureSession | undefined>(undefined);
  const dragMovedRef = useRef(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>();
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [fitScaleValue, setFitScaleValue] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const getPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) };
  }, []);

  const fitView = useCallback(() => {
    setScale(fitScaleValue);
    setOffset({ x: 0, y: 0 });
  }, [fitScaleValue]);

  const applyZoom = useCallback((nextScale: number, point: Point) => {
    if (!imageSize || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    const boundedScale = Math.max(fitScaleValue, Math.min(MAX_SCALE, nextScale));
    if (boundedScale <= fitScaleValue + 0.0001) {
      fitView();
      return;
    }
    const next = zoomAroundPoint(offset, scale, boundedScale, point, imageSize, viewportSize);
    setScale(next.scale);
    setOffset(next.offset);
  }, [fitScaleValue, fitView, imageSize, offset, scale, viewportSize]);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    applyZoom(scale * (event.deltaY < 0 ? 1.1 : 0.9), getPoint(event.clientX, event.clientY));
  }, [applyZoom, getPoint, scale]);

  useEffect(() => {
    const canvas = viewportCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize) return;
    viewportRef.current?.focus();
    const point = getPoint(event.clientX, event.clientY);
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragMovedRef.current = false;
    if (pointers.size === 1) {
      gestureRef.current = { kind: "pan", pointerId: event.pointerId, start: point, startOffset: offset };
    } else if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      if (!first || !second) return;
      gestureRef.current = { kind: "pinch", startDistance: Math.max(1, distance(first, second)), startCenter: midpoint(first, second), startOffset: offset, startScale: scale };
      setDragging(true);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize) return;
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    const point = getPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    const session = gestureRef.current;
    if (!session) return;
    if (pointers.size >= 2 && session.kind === "pinch") {
      const [first, second] = [...pointers.values()];
      if (!first || !second) return;
      const center = midpoint(first, second);
      const nextScale = Math.max(fitScaleValue, Math.min(MAX_SCALE, session.startScale * distance(first, second) / session.startDistance));
      const zoomed = zoomAroundPoint(session.startOffset, session.startScale, nextScale, session.startCenter, imageSize, viewportSize);
      setScale(zoomed.scale);
      setOffset(clampOffset({ x: zoomed.offset.x + center.x - session.startCenter.x, y: zoomed.offset.y + center.y - session.startCenter.y }, zoomed.scale, imageSize, viewportSize));
      dragMovedRef.current = true;
      return;
    }
    if (session.kind !== "pan") return;
    const canPan = panMode || spacePressed || scale > fitScaleValue + 0.0001 || event.pointerType === "touch";
    if (!canPan) return;
    const delta = { x: point.x - session.start.x, y: point.y - session.start.y };
    if (Math.hypot(delta.x, delta.y) > DRAG_THRESHOLD) {
      dragMovedRef.current = true;
      setDragging(true);
    }
    setOffset(clampOffset({ x: session.startOffset.x + delta.x, y: session.startOffset.y + delta.y }, scale, imageSize, viewportSize));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* 指针捕获可能已经释放 */ }
    if (pointersRef.current.size === 0) {
      gestureRef.current = undefined;
      setDragging(false);
    } else if (pointersRef.current.size === 1) {
      const entry = [...pointersRef.current.entries()][0];
      if (entry) {
        const [pointerId, point] = entry;
        gestureRef.current = { kind: "pan", pointerId, start: point, startOffset: offset };
      }
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSize || dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    const point = getPoint(event.clientX, event.clientY);
    const x = imageSize.width / 2 + (point.x - offset.x) / scale;
    const y = imageSize.height / 2 + (point.y - offset.y) / scale;
    const found = lines.find((line) => {
      const xs = line.polygon.map((item) => item.x);
      const ys = line.polygon.map((item) => item.y);
      return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys);
    });
    if (found) onSelect(found.index);
  };

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    if (!imageSize || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    const nextFit = fitScale(imageSize, viewportSize);
    setFitScaleValue(nextFit);
    setScale(nextFit);
    setOffset({ x: 0, y: 0 });
  }, [imageSize, viewportSize]);

  useLayoutEffect(() => {
    setImageReady(false);
    setImageSize(undefined);
    setFitScaleValue(1);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setPanMode(false);
    setSpacePressed(false);
    pointersRef.current.clear();
    gestureRef.current = undefined;
  }, [imageUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        setPanMode(false);
        setSpacePressed(false);
        pointersRef.current.clear();
        gestureRef.current = undefined;
        setDragging(false);
      } else if (event.code === "Space" && !isEditableTarget(event.target)) {
        event.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !imageReady || !imageSize) return;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    for (const line of lines) {
      context.beginPath();
      line.polygon.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      context.closePath();
      context.lineWidth = overlayStrokeWidth(scale, line.index === selected);
      context.strokeStyle = line.index === selected ? "#f59e0b" : "#16a34a";
      context.fillStyle = line.index === selected ? "rgba(245, 158, 11, .18)" : "rgba(22, 163, 74, .1)";
      context.fill();
      context.stroke();
    }
  }, [imageReady, imageSize, lines, scale, selected]);

  const transform = imageSize ? `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})` : undefined;
  const rootClass = `image-viewport${panMode || spacePressed ? " pan-mode" : ""}${dragging ? " dragging" : ""}`;

  return <div
    ref={viewportRef}
    className={rootClass}
    data-testid="image-viewport"
    data-scale={scale}
    data-fit-scale={fitScaleValue}
    data-offset-x={offset.x}
    data-offset-y={offset.y}
    data-pan-mode={panMode}
    data-space-drag={spacePressed}
    data-dragging={dragging}
    tabIndex={0}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd}
    onPointerCancel={handlePointerEnd}
  >
    <div className="viewport-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" title={copy.zoomOut} aria-label={copy.zoomOut} onClick={() => applyZoom(scale / 1.2, { x: 0, y: 0 })} disabled={!imageSize}><ZoomOut size={15} /></button>
      <span className="zoom-percent" data-testid="zoom-percent" aria-live="polite">{Math.round(scale * 100)}%</span>
      <button type="button" title={copy.zoomIn} aria-label={copy.zoomIn} onClick={() => applyZoom(scale * 1.2, { x: 0, y: 0 })} disabled={!imageSize}><ZoomIn size={15} /></button>
      <button type="button" className="fit-button" title={copy.fitView} aria-label={copy.fitView} onClick={fitView} disabled={!imageSize}><Maximize2 size={15} />{copy.fitView}</button>
      <button type="button" className={panMode ? "active" : ""} title={copy.pan} aria-label={copy.pan} aria-pressed={panMode} onClick={() => setPanMode((current) => !current)} disabled={!imageSize}><Hand size={15} />{copy.pan}</button>
      <span className="pan-hint">{copy.panHint}</span>
    </div>
    <div ref={viewportCanvasRef} className="viewport-canvas">
      {imageUrl ? <>
        <img ref={imageRef} data-testid="source-image" className="image-source" src={imageUrl} alt={imageAlt} onLoad={(event) => { const image = event.currentTarget; setImageSize({ width: image.naturalWidth, height: image.naturalHeight }); setImageReady(true); }} />
        <canvas ref={canvasRef} data-testid="result-canvas" className="result-canvas" style={transform ? { width: imageSize?.width, height: imageSize?.height, transform } : undefined} onClick={handleCanvasClick} />
      </> : <div className="empty"><span aria-hidden="true">+</span><p>{emptyText}</p></div>}
    </div>
  </div>;
}
