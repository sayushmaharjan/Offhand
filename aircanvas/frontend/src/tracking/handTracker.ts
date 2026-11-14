import type { Hand } from '../types';
export class HandTracker {
  private worker: Worker | null = null;
  private frame = 0;
  private busy = false;
  private stopped = false;
  private lastTime = -1;
  private lastRun = 0;
  private busySince = 0;
  private input = document.createElement('canvas');
  private fallback: import('@mediapipe/tasks-vision').HandLandmarker | null = null;
  async start(
    video: HTMLVideoElement,
    onHands: (hands: Hand[], t: number) => void,
    onError: (message: string) => void,
  ) {
    const base = new URL(import.meta.env.BASE_URL, location.href).href;
    try {
      await new Promise<void>((resolve, reject) => {
        this.worker = new Worker(new URL('./handWorker.ts', import.meta.url), { type: 'module' });
        const timeout = setTimeout(() => reject(new Error('Worker loading timed out')), 20000);
        this.worker.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Worker unavailable'));
        };
        this.worker.onmessage = (e) => {
          if (e.data.type === 'ready') {
            clearTimeout(timeout);
            resolve();
          }
          if (e.data.type === 'error') {
            clearTimeout(timeout);
            if (this.busy) {
              this.busy = false;
              onError(e.data.message);
            } else reject(new Error(e.data.message));
          }
          if (e.data.type === 'result') {
            this.busy = false;
            if (!this.stopped) onHands(e.data.hands, e.data.t);
          }
        };
        this.worker.postMessage({ type: 'init', base });
      });
    } catch {
      this.worker?.terminate();
      this.worker = null;
      if (this.stopped) return;
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(base + 'wasm');
      this.fallback = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: base + 'models/hand_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
    }
    if (this.stopped) {
      this.stop();
      return;
    }
    const tick = async (t: number) => {
      if (this.stopped) return;
      this.frame = requestAnimationFrame(tick);
      if (this.busy && t - this.busySince > 2000) {
        this.stop();
        onError('Hand tracking stopped responding. Restart the camera or use Mouse mode.');
        return;
      }
      if (
        this.busy ||
        t - this.lastRun < 1000 / 24 ||
        video.currentTime === this.lastTime ||
        video.readyState < 2
      )
        return;
      this.lastTime = video.currentTime;
      this.lastRun = t;
      this.busy = true;
      this.busySince = t;
      const w = 640,
        h = Math.round((w * video.videoHeight) / video.videoWidth);
      if (!h) {
        this.busy = false;
        return;
      }
      if (this.input.width !== w || this.input.height !== h) {
        this.input.width = w;
        this.input.height = h;
      }
      const ctx = this.input.getContext('2d')!;
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
      try {
        if (this.worker) {
          const bitmap = await createImageBitmap(this.input);
          if (this.stopped) {
            bitmap.close();
            return;
          }
          this.worker.postMessage({ type: 'frame', bitmap, t }, [bitmap]);
        } else if (this.fallback) {
          const result = this.fallback.detectForVideo(this.input, t);
          this.busy = false;
          onHands(
            result.landmarks.map((points, i) => ({
              points,
              label: result.handedness[i][0].categoryName as Hand['label'],
              confidence: result.handedness[i][0].score,
            })),
            t,
          );
        }
      } catch (error) {
        this.busy = false;
        this.stop();
        onError(
          error instanceof Error
            ? error.message
            : 'Tracking failed. Mouse mode is still available.',
        );
      }
    };
    this.frame = requestAnimationFrame(tick);
  }
  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.worker?.terminate();
    this.worker = null;
    this.fallback?.close();
    this.fallback = null;
  }
}
