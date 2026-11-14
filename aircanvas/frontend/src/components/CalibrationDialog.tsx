import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Camera, Hand, Move, ScanLine } from 'lucide-react';
import { Modal } from './Modal';
import { VideoSurface } from './CameraPreview';
import { Range } from './SettingsDialog';
import type { Editor } from '../storage/pageStore';
import type { AirController } from '../tracking/fingerPointer';
import type { XY } from '../types';
const steps = [
  [
    'Let’s meet your hands.',
    'Enable your webcam. Everything your camera sees is processed on this device.',
  ],
  [
    'Both hands in the frame.',
    'Hold both hands up with your palms facing the camera. Give them a little space.',
  ],
  [
    'Meet your writing hand.',
    'Raise only your writing hand. If the wrong hand is detected, invert the hand labels below.',
  ],
  [
    'Find your range.',
    'Move your writing index finger around. Keep your hand in frame and explore the canvas.',
  ],
  [
    'Make your first pinch.',
    'Touch your writing thumb and index fingertip, hold briefly, then release.',
  ],
  [
    'Ready your other hand.',
    'Show an open palm with your navigation hand. This prepares the canvas to be grabbed.',
  ],
  ['Grab some space.', 'Close that open palm into a fist. Then open it again to release.'],
  [
    'A canvas that feels natural.',
    'Adjust the sensitivity if you like. You can always revisit these settings.',
  ],
];
export function CalibrationDialog({
  editor,
  air,
  stream,
  cameraStatus,
  connect,
  error,
  onClose,
}: {
  editor: Editor;
  air: AirController;
  stream: MediaStream | null;
  cameraStatus: string;
  connect: () => void;
  error: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0),
    [detected, setDetected] = useState(false);
  const origin = useRef<XY | null>(null),
    seen = useRef(false);
  useEffect(() => {
    setDetected(false);
    origin.current = null;
    seen.current = false;
    const timer = setInterval(() => {
      const f = air.feedback,
        w = air.lastWriting,
        n = air.lastNavigation;
      if (step === 0 && stream) setDetected(true);
      if (step === 1 && f.writing && f.navigation) setDetected(true);
      if (step === 2 && f.writing && !f.navigation) setDetected(true);
      if (step === 3 && w) {
        origin.current ??= w.tip;
        if (Math.hypot(w.tip.x - origin.current.x, w.tip.y - origin.current.y) > 0.15)
          setDetected(true);
      }
      if (step === 4) {
        if (w?.pinch) seen.current = true;
        if (seen.current && w && !w.pinch) setDetected(true);
      }
      if (step === 5 && n?.open) setDetected(true);
      if (step === 6) {
        if (n?.fist) seen.current = true;
        if (seen.current && n?.open) setDetected(true);
      }
      if (step === 7) setDetected(true);
    }, 100);
    return () => clearInterval(timer);
  }, [step, air, stream]);
  return (
    <Modal
      title="A quick hand check."
      subtitle={`STEP ${step + 1} OF 8 · ABOUT A MINUTE`}
      onClose={onClose}
    >
      <div className="calibration-preview">
        {stream ? <VideoSurface stream={stream} /> : <Camera size={42} />}
        <div className="calibration-hands">
          <span className={air.feedback.writing ? 'detected' : ''}>
            Writing hand {air.feedback.writing ? '✓' : '—'}
          </span>
          <span className={air.feedback.navigation ? 'detected' : ''}>
            Navigation hand {air.feedback.navigation ? '✓' : '—'}
          </span>
        </div>
      </div>
      <div className="step-dots">
        {steps.map((_, i) => (
          <span className={i <= step ? 'active' : ''} key={i} />
        ))}
      </div>
      <div className="calibration-copy">
        <div className="calibration-icon">
          {step === 0 ? <Camera /> : step === 3 ? <Move /> : step === 7 ? <ScanLine /> : <Hand />}
        </div>
        <h3>{steps[step][0]}</h3>
        <p>{steps[step][1]}</p>
      </div>
      {step === 0 && !stream && (
        <button
          className="button primary full-width"
          disabled={cameraStatus === 'loading'}
          onClick={connect}
        >
          <Camera size={16} />
          {cameraStatus === 'loading' ? 'Connecting…' : 'Enable camera'}
        </button>
      )}
      {step === 2 && (
        <div className="calibration-options">
          <label>
            Writing hand
            <select
              aria-label="Calibration writing hand"
              value={editor.settings.writingHand}
              onChange={(e) =>
                editor.configure({ writingHand: e.target.value as 'Left' | 'Right' })
              }
            >
              <option>Right</option>
              <option>Left</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={editor.settings.invertHands}
              onChange={(e) => editor.configure({ invertHands: e.target.checked })}
            />{' '}
            Invert hand labels
          </label>
        </div>
      )}
      {step === 7 && (
        <div className="settings-grid">
          <Range
            label="Pinch sensitivity"
            min={0.12}
            max={0.6}
            value={editor.settings.pinch}
            onChange={(v) => editor.configure({ pinch: v })}
          />
          <Range
            label="Grab sensitivity"
            min={0.5}
            max={2}
            value={editor.settings.grabSensitivity}
            onChange={(v) => editor.configure({ grabSensitivity: v })}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <button className="text-button" onClick={onClose}>
          Set up later
        </button>
        <button
          className="button primary"
          disabled={!detected}
          onClick={() => {
            if (step === 7) {
              editor.configure({ calibrated: true });
              onClose();
            } else setStep(step + 1);
          }}
        >
          {detected ? <Check size={16} /> : null}
          {step === 7 ? 'Start creating' : detected ? 'Continue' : 'Waiting for gesture'}
          <ArrowRight size={15} />
        </button>
      </footer>
    </Modal>
  );
}
