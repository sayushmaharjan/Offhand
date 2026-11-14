import type { Page } from '../types';
import { contentBounds } from '../canvas/strokeEngine';
import { coverRect } from '../canvas/coordinateTransforms';
import { renderStrokes } from '../canvas/canvasRenderer';
export type ExportOptions = {
  background: 'white' | 'camera';
  scope: 'viewport' | 'all';
  scale: number;
  width: number;
  height: number;
  overlayOpacity: number;
};
export function drawMirroredCamera(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
) {
  const r = coverRect(video.videoWidth, video.videoHeight, w, h);
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, r.x, r.y, r.width, r.height);
  ctx.restore();
}
export function renderExport(
  page: Page,
  options: ExportOptions,
  video?: HTMLVideoElement | null,
): HTMLCanvasElement {
  let w = options.width,
    h = options.height,
    v = page.viewport;
  if (options.background === 'white' && options.scope === 'all') {
    const b = contentBounds(page.strokes);
    if (b) {
      w = Math.max(128, b.maxX - b.minX + 80);
      h = Math.max(128, b.maxY - b.minY + 80);
      v = { zoom: 1, x: 40 - b.minX, y: 40 - b.minY };
    }
  }
  const width = Math.ceil(w * options.scale),
    height = Math.ceil(h * options.scale);
  if (width > 16384 || height > 16384 || width * height > 64000000)
    throw new Error(
      'This export is too large. Use standard resolution or export the current view.',
    );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the PNG.');
  ctx.scale(options.scale, options.scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (options.background === 'camera') {
    if (!video || video.readyState < 2 || !video.videoWidth)
      throw new Error('Connect the camera before exporting a camera background.');
    drawMirroredCamera(ctx, video, w, h);
    ctx.fillStyle = `rgba(255,255,255,${options.overlayOpacity})`;
    ctx.fillRect(0, 0, w, h);
  }
  renderStrokes(ctx, page.strokes, v, w, h);
  return canvas;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportPNG(
  page: Page,
  options: ExportOptions,
  video?: HTMLVideoElement | null,
) {
  const canvas = renderExport(page, options, video);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG encoding failed. Try standard resolution.'))),
      'image/png',
    ),
  );
  const now = new Date(),
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  downloadBlob(blob, `AirCanvas_${page.name.replace(/[^a-z0-9_-]/gi, '_')}_${date}.png`);
}
