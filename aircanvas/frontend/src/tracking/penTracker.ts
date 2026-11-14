import type { XY } from '../types';
export interface PenTipTracker {
  detect(video: HTMLVideoElement, hue: number, tolerance: number): Promise<XY | null>;
  close(): void;
}
// Replace this adapter with a custom local keypoint detector without touching the ink engine.
export class ColorMarkerTracker implements PenTipTracker {
  private canvas = document.createElement('canvas');
  private request: AbortController | null = null;
  async detect(video: HTMLVideoElement, hue: number, tolerance: number): Promise<XY | null> {
    this.canvas.width = 640;
    this.canvas.height = Math.round((640 * video.videoHeight) / video.videoWidth);
    const ctx = this.canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      this.canvas.toBlob(resolve, 'image/jpeg', 0.75),
    );
    if (!blob) return null;
    this.request = new AbortController();
    const timeout = setTimeout(() => this.request?.abort(), 1200);
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/track?hue=${hue}&tolerance=${tolerance}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
          signal: this.request.signal,
        },
      );
      if (!response.ok) throw new Error('Local marker tracker returned an error.');
      const result = await response.json();
      return result.found && result.confidence >= 0.45 ? { x: 1 - result.x, y: result.y } : null;
    } finally {
      clearTimeout(timeout);
    }
  }
  close() {
    this.request?.abort();
  }
}
export function sampleMarkerHue(video: HTMLVideoElement, x: number, y: number): number {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  const data = ctx.getImageData(
    Math.max(0, Math.min(canvas.width - 1, Math.round((1 - x) * canvas.width))),
    Math.max(0, Math.min(canvas.height - 1, Math.round(y * canvas.height))),
    1,
    1,
  ).data;
  const [r, g, b] = [data[0] / 255, data[1] / 255, data[2] / 255],
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d < 0.18 || max < 0.25)
    throw new Error('Choose a bright, saturated marker, such as green, pink or blue.');
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return Math.round(h / 2) % 180;
}
