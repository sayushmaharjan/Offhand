import type { Hand, Gesture, XY } from '../types';
const distance = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
export class GestureRecognizer {
  private pinched = false;
  private pinchFrames = 0;
  reset() {
    this.pinched = false;
    this.pinchFrames = 0;
  }
  recognize(hand: Hand, threshold: number): Gesture {
    const p = hand.points,
      scale = Math.max(0.025, distance(p[0], p[9]));
    const extended = [8, 12, 16, 20].map(
      (t) =>
        distance(p[t], p[0]) > distance(p[t - 2], p[0]) * 1.2 &&
        distance(p[t], p[t - 3]) > distance(p[t - 2], p[t - 3]) * 1.25,
    );
    const fist =
      extended.every((x) => !x) &&
      [8, 12, 16, 20].every((t) => distance(p[t], p[0]) < scale * 1.35);
    const ratio = distance(p[4], p[8]) / scale;
    if (fist || ratio > threshold + 0.12) {
      this.pinched = false;
      this.pinchFrames = 0;
    } else if (ratio < threshold) {
      this.pinchFrames++;
      if (this.pinchFrames >= 2) this.pinched = true;
    } else if (!this.pinched) this.pinchFrames = 0;
    return {
      pinch: this.pinched,
      open: extended.every(Boolean) && !this.pinched && distance(p[4], p[17]) > scale * 0.8,
      fist,
      pointing: extended[0] && !extended[1] && !extended[2] && !extended[3],
      center: {
        x: (p[0].x + p[5].x + p[9].x + p[17].x) / 4,
        y: (p[0].y + p[5].y + p[9].y + p[17].y) / 4,
      },
      tip: p[8],
    };
  }
}
// Match short-lived identities using their previous trajectory AND model label, never screen side.
export class HandIdentityResolver {
  private previous = new Map<string, { hand: Hand; t: number }>();
  resolve(hands: Hand[], t: number): Hand[] {
    const candidates = hands
        .filter((h) => h.confidence >= 0.35)
        .sort((a, b) => b.confidence - a.confidence),
      used = new Set<string>(),
      result: Hand[] = [];
    for (const hand of candidates) {
      let label = hand.label,
        best = 0.18;
      for (const [known, prev] of this.previous) {
        const d = distance(hand.points[0], prev.hand.points[0]);
        if (t - prev.t < 600 && d < best && !used.has(known)) {
          best = d;
          label = known as Hand['label'];
        }
      }
      if (used.has(label)) continue;
      const resolved = { ...hand, label };
      used.add(label);
      result.push(resolved);
    }
    for (const hand of result) this.previous.set(hand.label, { hand, t });
    return result;
  }
}
