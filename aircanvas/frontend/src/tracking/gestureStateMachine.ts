import type { Gesture, XY } from '../types';
export type PanState = 'IDLE' | 'PALM_VISIBLE' | 'GRABBING' | 'DRAGGING' | 'RELEASED';
export class GrabStateMachine {
  state: PanState = 'IDLE';
  private openFrames = 0;
  private fistFrames = 0;
  private anchor: XY | null = null;
  private armedAt = 0;
  reset() {
    this.state = 'IDLE';
    this.openFrames = 0;
    this.fistFrames = 0;
    this.anchor = null;
  }
  update(g: Gesture | null, position: XY | null, t: number, sensitivity = 1): XY | null {
    if (!g || !position) {
      this.reset();
      return null;
    }
    if (g.open) {
      this.openFrames++;
      this.fistFrames = 0;
      this.anchor = null;
      if (this.state === 'GRABBING' || this.state === 'DRAGGING') {
        this.state = 'RELEASED';
        this.openFrames = 1;
      } else if (this.openFrames >= 2) {
        this.state = 'PALM_VISIBLE';
        this.armedAt = t;
      }
      return null;
    }
    this.openFrames = 0;
    if (this.state === 'GRABBING' || this.state === 'DRAGGING') {
      if (!g.fist) {
        this.state = 'RELEASED';
        this.anchor = null;
        this.fistFrames = 0;
        return null;
      }
      const dx = position.x - this.anchor!.x,
        dy = position.y - this.anchor!.y;
      if (Math.hypot(dx, dy) > Math.max(150, 300 * sensitivity)) {
        this.reset();
        return null;
      }
      if (Math.hypot(dx, dy) > 2) {
        this.anchor = position;
        this.state = 'DRAGGING';
        return { x: dx * sensitivity, y: dy * sensitivity };
      }
      return null;
    }
    if (this.state === 'PALM_VISIBLE' && t - this.armedAt < 1800) {
      if (g.fist) {
        if (++this.fistFrames >= 2) {
          this.state = 'GRABBING';
          this.anchor = position;
        }
      } else this.fistFrames = 0;
    } else {
      this.state = 'IDLE';
      this.fistFrames = 0;
    }
    return null;
  }
}
