import { useEffect, useRef, useState } from 'react';
import type { Editor } from '../storage/pageStore';
import { AirController } from '../tracking/fingerPointer';
import { HandTracker } from '../tracking/handTracker';
import { ColorMarkerTracker } from '../tracking/penTracker';
import type { Hand, XY } from '../types';
export function useTracking(
  editor: Editor,
  air: AirController,
  video: HTMLVideoElement,
  connected: boolean,
  blocked: boolean,
) {
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const [feedback, setFeedback] = useState(air.feedback),
    [status, setStatus] = useState('Off'),
    [error, setError] = useState('');
  const mode = editor.settings.mode;
  air.isBlockedAt = (point) => !!document.elementFromPoint(point.x, point.y)?.closest('[data-ui]');
  useEffect(() => {
    air.stop();
    setFeedback({ ...air.feedback });
    setError('');
    if (!connected || mode === 'mouse') {
      setStatus('Off');
      return;
    }
    let disposed = false,
      lastUI = 0,
      lastHands = 0,
      latest: Hand[] = [],
      marker: XY | null = null,
      markerTime = 0,
      penBusy = false,
      penError = '';
    const tracker = new HandTracker(),
      pen = new ColorMarkerTracker();
    setStatus('Loading hand model…');
    const update = (t: number) => {
      const stale = t - lastHands > 220,
        blocked = blockedRef.current || document.hidden;
      air.update(
        stale ? [] : latest,
        t,
        { width: video.videoWidth, height: video.videoHeight },
        blocked,
        t - markerTime < 180 ? marker : null,
      );
      if (t - lastUI > 80) {
        setFeedback({ ...air.feedback });
        if (penError) setError(penError);
        lastUI = t;
      }
    };
    tracker
      .start(
        video,
        (hands, t) => {
          if (disposed) return;
          const now = performance.now();
          latest = now - t > 220 ? [] : hands;
          lastHands = t;
          setStatus('Tracking');
          update(now);
        },
        (message) => {
          if (disposed) return;
          air.stop();
          latest = [];
          setError(`Hand model: ${message} Restart the camera to retry; Mouse mode is available.`);
          setStatus('Unavailable');
        },
      )
      .catch((e) => {
        if (!disposed) {
          setError(
            `Hand model could not load: ${e.message}. Run npm run assets, then restart the camera. Mouse mode is available.`,
          );
          setStatus('Unavailable');
        }
      });
    const watchdog = setInterval(() => {
      if (disposed) return;
      const t = performance.now();
      if (t - lastHands > 220) update(t);
      if (mode === 'pen' && !penBusy && video.readyState >= 2) {
        penBusy = true;
        const capturedAt = performance.now();
        pen
          .detect(video, editor.settings.markerHue, editor.settings.markerTolerance)
          .then((p) => {
            if (disposed) return;
            markerTime = performance.now();
            marker = markerTime - capturedAt <= 220 ? p : null;
            if (penError) {
              penError = '';
              setError('');
            }
            update(markerTime);
          })
          .catch(() => {
            marker = null;
            penError =
              'Pen tracker is offline. Start the optional Python server on port 8000, then reconnect Pen mode.';
          })
          .finally(() => {
            penBusy = false;
          });
      }
    }, 50);
    return () => {
      disposed = true;
      clearInterval(watchdog);
      tracker.stop();
      pen.close();
      air.stop();
    };
  }, [connected, mode, video, editor, air]);
  useEffect(() => {
    if (blocked) air.stop();
  }, [blocked, air]);
  return { feedback, status, error };
}
