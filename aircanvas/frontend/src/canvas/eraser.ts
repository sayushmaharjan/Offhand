import type { XY, Stroke } from '../types';
export function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function hitStroke(s: Stroke, p: XY, radius: number): boolean {
  const r = radius + s.width / 2,
    b = s.bounds;
  if (p.x < b.minX - r || p.x > b.maxX + r || p.y < b.minY - r || p.y > b.maxY + r) return false;
  if (s.points.length === 1) return Math.hypot(p.x - s.points[0].x, p.y - s.points[0].y) <= r;
  return s.points.slice(1).some((point, i) => distanceToSegment(p, s.points[i], point) <= r);
}
