import { useCallback, useEffect, useState } from 'react';
export function useCamera(onStop: () => void) {
  const [video] = useState(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    return v;
  });
  const [stream, setStream] = useState<MediaStream | null>(null),
    [status, setStatus] = useState<'off' | 'loading' | 'connected' | 'error'>('off'),
    [error, setError] = useState('');
  const stop = useCallback(() => {
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    setStream(null);
    setStatus('off');
    setError('');
    onStop();
  }, [video, onStop]);
  const start = useCallback(async () => {
    if (status === 'loading' || status === 'connected') return;
    setStatus('loading');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Camera access requires localhost or HTTPS and a supported browser. Mouse mode is available.',
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject = media;
      await video.play();
      setStream(media);
      setStatus('connected');
      media.getVideoTracks()[0].onended = () => {
        onStop();
        setStream(null);
        setStatus('error');
        setError('Camera disconnected. Reconnect it and try again.');
      };
    } catch (e) {
      (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      setStatus('error');
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access in your browser’s site settings, then try again.'
          : name === 'NotFoundError'
            ? 'No webcam found. Connect one, or keep drawing in Mouse mode.'
            : e instanceof Error
              ? e.message
              : 'Camera could not start.',
      );
    }
  }, [video, status, onStop]);
  useEffect(
    () => () => {
      (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    },
    [video],
  );
  return { video, stream, status, error, start, stop };
}
