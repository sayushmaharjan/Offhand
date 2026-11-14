import type { Point } from '../types';
const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
export class OneEuroFilter {
  private previous: Point | null = null;
  private dx = 0;
  private dy = 0;
  private filtered: Point | null = null;
  reset() {
    this.previous = null;
    this.filtered = null;
    this.dx = 0;
    this.dy = 0;
  }
  next(p: Point, amount = 0.45): Point {
    if (!this.previous || !this.filtered || p.t - this.previous.t > 180) {
      this.previous = p;
      this.filtered = p;
      return p;
    }
    const dt = Math.max(0.001, (p.t - this.previous.t) / 1000),
      a = alpha(1, dt);
    this.dx += a * ((p.x - this.previous.x) / dt - this.dx);
    this.dy += a * ((p.y - this.previous.y) / dt - this.dy);
    const cutoff = 1.4 + (1 - amount) * 8 + 0.035 * Math.hypot(this.dx, this.dy),
      f = alpha(cutoff, dt);
    this.filtered = {
      x: this.filtered.x + f * (p.x - this.filtered.x),
      y: this.filtered.y + f * (p.y - this.filtered.y),
      t: p.t,
    };
    this.previous = p;
    return this.filtered;
  }
}
