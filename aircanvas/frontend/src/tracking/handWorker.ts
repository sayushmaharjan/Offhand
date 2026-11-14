/// <reference lib="webworker" />
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
let model: HandLandmarker | null = null;
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(message.base + 'wasm');
      const options = {
        baseOptions: { modelAssetPath: message.base + 'models/hand_landmarker.task' },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      };
      try {
        model = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'GPU' },
        });
      } catch {
        model = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        });
      }
      worker.postMessage({ type: 'ready' });
    } else if (message.type === 'frame' && model) {
      try {
        const result = model.detectForVideo(message.bitmap, message.t);
        worker.postMessage({
          type: 'result',
          t: message.t,
          hands: result.landmarks.map((points, i) => ({
            points,
            label: result.handedness[i][0].categoryName,
            confidence: result.handedness[i][0].score,
          })),
        });
      } finally {
        message.bitmap.close();
      }
    }
  } catch (error) {
    worker.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
