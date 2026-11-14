import type { Page, Stroke, Viewport } from '../types';
import { drawStroke } from './strokeEngine';
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  v: Viewport,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.scale(v.zoom, v.zoom);
  const minX = -v.x / v.zoom,
    minY = -v.y / v.zoom,
    maxX = (w - v.x) / v.zoom,
    maxY = (h - v.y) / v.zoom;
  for (const s of strokes) {
    const b = s.bounds;
    if (b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY) drawStroke(ctx, s);
  }
  ctx.restore();
}
export class CanvasRenderer {
  private cache = document.createElement('canvas');
  private key = '';
  render(
    canvas: HTMLCanvasElement,
    page: Page,
    live: Stroke | null,
    grid: boolean,
    w: number,
    h: number,
  ) {
    const dpr = Math.min(devicePixelRatio || 1, 3),
      pw = Math.round(w * dpr),
      ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (grid) {
      const step = 24 * page.viewport.zoom;
      if (step >= 8) {
        ctx.fillStyle = '#a7b3b530';
        for (let x = ((page.viewport.x % step) + step) % step; x < w; x += step)
          for (let y = ((page.viewport.y % step) + step) % step; y < h; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 0.85, 0, Math.PI * 2);
            ctx.fill();
          }
      }
    }
    const key = `${page.id}:${page.revision}:${page.strokes.length}:${JSON.stringify(page.viewport)}:${pw}:${ph}`;
    if (key !== this.key) {
      this.cache.width = pw;
      this.cache.height = ph;
      const c = this.cache.getContext('2d')!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderStrokes(c, page.strokes, page.viewport, w, h);
      this.key = key;
    }
    ctx.drawImage(this.cache, 0, 0, w, h);
    if (live) renderStrokes(ctx, [live], page.viewport, w, h);
  }
}
