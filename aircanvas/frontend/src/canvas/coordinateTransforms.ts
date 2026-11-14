import type { XY, Viewport, Bounds } from '../types';
export const screenToWorld = (p: XY, v: Viewport): XY => ({
  x: (p.x - v.x) / v.zoom,
  y: (p.y - v.y) / v.zoom,
});
export const worldToScreen = (p: XY, v: Viewport): XY => ({
  x: p.x * v.zoom + v.x,
  y: p.y * v.zoom + v.y,
});
export function coverRect(sourceW: number, sourceH: number, w: number, h: number) {
  const scale = Math.max(w / sourceW, h / sourceH);
  const width = sourceW * scale,
    height = sourceH * scale;
  return { x: (w - width) / 2, y: (h - height) / 2, width, height };
}
// The same cover geometry drives the preview, tracking and PNG export.
export function cameraToScreen(
  p: XY,
  sw: number,
  sh: number,
  w: number,
  h: number,
  mirrored = false,
): XY {
  const r = coverRect(sw, sh, w, h);
  return { x: r.x + (mirrored ? 1 - p.x : p.x) * r.width, y: r.y + p.y * r.height };
}
export function zoomAt(v: Viewport, anchor: XY, factor: number): Viewport {
  const world = screenToWorld(anchor, v),
    zoom = Math.min(8, Math.max(0.1, v.zoom * factor));
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}
export function fitBounds(b: Bounds, w: number, h: number, padding = 100): Viewport {
  const zoom = Math.min(
    3,
    Math.max(
      0.1,
      Math.min(
        Math.max(1, w - padding * 2) / Math.max(1, b.maxX - b.minX),
        Math.max(1, h - padding * 2) / Math.max(1, b.maxY - b.minY),
      ),
    ),
  );
  return {
    zoom,
    x: w / 2 - ((b.minX + b.maxX) / 2) * zoom,
    y: h / 2 - ((b.minY + b.maxY) / 2) * zoom,
  };
}
