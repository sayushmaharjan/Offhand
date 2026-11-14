import type { Stroke, Point, Bounds } from '../types';
export function boundsOf(points: Point[], width = 0): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    b.minX = Math.min(b.minX, p.x - width / 2);
    b.minY = Math.min(b.minY, p.y - width / 2);
    b.maxX = Math.max(b.maxX, p.x + width / 2);
    b.maxY = Math.max(b.maxY, p.y + width / 2);
  }
  return b;
}
export function contentBounds(strokes: Stroke[]): Bounds | null {
  if (!strokes.length) return null;
  return strokes.reduce(
    (b, s) => ({
      minX: Math.min(b.minX, s.bounds.minX),
      minY: Math.min(b.minY, s.bounds.minY),
      maxX: Math.max(b.maxX, s.bounds.maxX),
      maxY: Math.max(b.maxY, s.bounds.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  if (!pts.length) return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = s.opacity;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    // Midpoint quadratics keep overshoot bounded at sharp letter corners.
    for (let i = 1; i < pts.length - 1; i++)
      ctx.quadraticCurveTo(
        pts[i].x,
        pts[i].y,
        (pts[i].x + pts[i + 1].x) / 2,
        (pts[i].y + pts[i + 1].y) / 2,
      );
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}
