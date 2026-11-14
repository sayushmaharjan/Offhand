import { useEffect, useRef } from 'react';
import { Video, VideoOff, Expand, ShieldCheck } from 'lucide-react';
export function VideoSurface({
  stream,
  className = '',
}: {
  stream: MediaStream | null;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      if (stream) ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video className={className} ref={ref} muted playsInline autoPlay />;
}
export function CameraPreview({
  stream,
  status,
  connect,
  stop,
  overlay,
  toggleOverlay,
  visible,
}: {
  stream: MediaStream | null;
  status: string;
  connect: () => void;
  stop: () => void;
  overlay: boolean;
  toggleOverlay: () => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <section className="camera-card glass" aria-label="Camera preview" data-ui>
      <div className="camera-heading">
        <span>
          <span className={`status-dot ${stream ? 'online' : ''}`} />
          {stream ? 'CAMERA CONNECTED' : 'YOUR CAMERA'}
        </span>
        <button
          className="icon-button"
          aria-label={overlay ? 'Whiteboard view' : 'Camera overlay view'}
          title="Toggle camera overlay"
          onClick={toggleOverlay}
        >
          <Expand size={14} />
        </button>
      </div>
      <div className={`camera-image ${stream ? 'live' : ''}`}>
        {stream ? (
          <VideoSurface stream={stream} />
        ) : (
          <div className="camera-empty">
            <VideoOff size={22} />
            <p>Your hands. Your canvas.</p>
            <button className="button" disabled={status === 'loading'} onClick={connect}>
              <Video size={14} />
              {status === 'loading' ? 'Connecting…' : 'Enable camera'}
            </button>
          </div>
        )}
        {stream && (
          <button className="stop-camera" aria-label="Disconnect camera" onClick={stop}>
            <VideoOff size={14} />
          </button>
        )}
        <span className="camera-corner corner-tl" />
        <span className="camera-corner corner-br" />
      </div>
      <footer>
        <ShieldCheck size={12} />
        <span>Private by design. Processed locally.</span>
      </footer>
    </section>
  );
}
