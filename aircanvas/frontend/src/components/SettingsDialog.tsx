import { Download, Upload, ScanLine, SlidersHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { VideoSurface } from './CameraPreview';
import type { Editor } from '../storage/pageStore';
import type { Settings } from '../types';
import { sampleMarkerHue } from '../tracking/penTracker';
export function Range({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  help?: string;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>{Number(value.toFixed(2))}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {help && <small>{help}</small>}
    </label>
  );
}
export function SettingsDialog({
  editor,
  video,
  stream,
  onClose,
  onCalibrate,
  onExport,
  onImport,
}: {
  editor: Editor;
  video: HTMLVideoElement;
  stream: MediaStream | null;
  onClose: () => void;
  onCalibrate: () => void;
  onExport: () => void;
  onImport: (f: File) => void;
}) {
  const s = editor.settings,
    file = useRef<HTMLInputElement>(null),
    [error, setError] = useState('');
  const update = (patch: Partial<Settings>) => editor.configure(patch);
  return (
    <Modal
      title="Make it feel like you."
      subtitle="A few small adjustments for a more natural canvas."
      onClose={onClose}
      wide
    >
      <div className="settings-scroll">
        <div className="settings-section">
          <h3>
            <SlidersHorizontal size={16} />
            Canvas & camera
          </h3>
          <div className="settings-grid">
            <Toggle label="Dot grid" checked={s.grid} onChange={(v) => update({ grid: v })} />
            <Toggle
              label="Camera preview"
              checked={s.preview}
              onChange={(v) => update({ preview: v })}
            />
            <Toggle
              label="Camera overlay"
              checked={s.overlay}
              onChange={(v) => update({ overlay: v })}
            />
            <Toggle
              label="Gesture feedback"
              checked={s.feedback}
              onChange={(v) => update({ feedback: v })}
            />
          </div>
          <Range
            label="Whiteboard opacity"
            value={s.overlayOpacity}
            min={0}
            max={1}
            onChange={(v) => update({ overlayOpacity: v })}
          />
        </div>
        <div className="settings-section">
          <h3>Writing & gestures</h3>
          <div className="form-row">
            <label htmlFor="writing-hand">Writing hand</label>
            <select
              id="writing-hand"
              value={s.writingHand}
              onChange={(e) => update({ writingHand: e.target.value as Settings['writingHand'] })}
            >
              <option value="Right">Right hand</option>
              <option value="Left">Left hand</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="activation">Pen-down gesture</label>
            <select
              id="activation"
              value={s.activation}
              onChange={(e) => update({ activation: e.target.value as Settings['activation'] })}
            >
              <option value="pinch">Thumb + index pinch</option>
              <option value="point">Index extended, other fingers curled</option>
            </select>
          </div>
          <div className="settings-grid">
            <Range
              label="Stroke smoothing"
              value={s.smoothing}
              min={0}
              max={1}
              onChange={(v) => update({ smoothing: v })}
            />
            <Range
              label="Minimum movement (px)"
              value={s.minMovement}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => update({ minMovement: v })}
            />
            <Range
              label="Pinch sensitivity"
              value={s.pinch}
              min={0.12}
              max={0.6}
              onChange={(v) => update({ pinch: v })}
              help="Higher values make a looser pinch draw."
            />
            <Range
              label="Tracking confidence"
              value={s.confidence}
              min={0.3}
              max={0.95}
              onChange={(v) => update({ confidence: v })}
            />
            <Range
              label="Pointer sensitivity"
              value={s.sensitivity}
              min={0.5}
              max={2}
              onChange={(v) => update({ sensitivity: v })}
              help="Keep at 1 for exact camera alignment."
            />
            <Range
              label="Grab sensitivity"
              value={s.grabSensitivity}
              min={0.5}
              max={2}
              onChange={(v) => update({ grabSensitivity: v })}
            />
          </div>
          <Toggle
            label="Invert model hand labels"
            checked={s.invertHands}
            onChange={(v) => update({ invertHands: v })}
          />
          <p className="field-help">
            Use only if calibration identifies your physical hands incorrectly.
          </p>
          <button className="button secondary" onClick={onCalibrate}>
            <ScanLine size={16} />
            Run hand calibration
          </button>
        </div>
        <div className="settings-section">
          <h3>Colored-marker stylus</h3>
          <p className="field-help">
            Place a small, bright colored marker close to your pen tip. Start the optional local
            tracker, then click the marker in this preview to sample its color.
          </p>
          {stream ? (
            <div
              className="marker-calibration"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                try {
                  update({
                    markerHue: sampleMarkerHue(
                      video,
                      (e.clientX - r.left) / r.width,
                      (e.clientY - r.top) / r.height,
                    ),
                  });
                  setError('');
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
              style={{ aspectRatio: video.videoWidth / video.videoHeight || 16 / 9 }}
            >
              <VideoSurface stream={stream} />
              <span>Click your colored marker</span>
            </div>
          ) : (
            <p className="inline-note">Connect your camera to sample a marker color.</p>
          )}
          <div className="settings-grid">
            <Range
              label="Marker hue (HSV)"
              value={s.markerHue}
              min={0}
              max={179}
              step={1}
              onChange={(v) => update({ markerHue: v })}
            />
            <Range
              label="Color tolerance"
              value={s.markerTolerance}
              min={3}
              max={45}
              step={1}
              onChange={(v) => update({ markerTolerance: v })}
            />
          </div>
          <p className="field-help">
            Navigation hand pinch: draw · Open palm: hover · Fist after open palm: pan. Press{' '}
            <kbd>D</kbd> to toggle pen down when using a marker. A visible marker alone never draws.
          </p>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
        </div>
        <div className="settings-section">
          <h3>Keep a copy</h3>
          <p className="field-help">
            Autosave stays in this browser. Project files keep every page, stroke, view, and
            preference portable.
          </p>
          <div className="flex gap-3">
            <button className="button secondary" onClick={onExport}>
              <Download size={15} />
              Export project
            </button>
            <button className="button secondary" onClick={() => file.current?.click()}>
              <Upload size={15} />
              Import project
            </button>
            <input
              ref={file}
              className="hidden"
              type="file"
              accept="application/json,.json"
              aria-label="Import project file"
              onChange={(e) => {
                if (e.target.files?.[0]) onImport(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="shortcut-grid">
          {[
            ['⌘/Ctrl Z', 'Undo'],
            ['⇧ ⌘/Ctrl Z', 'Redo'],
            ['B / E / H', 'Pen / eraser / pan'],
            ['Space + drag', 'Pan canvas'],
            ['⌘/Ctrl S', 'Export PNG'],
            ['+ / −', 'Zoom'],
            ['Shift + scroll', 'Pan'],
            ['D', 'Stylus drawing toggle'],
          ].map(([key, label]) => (
            <div key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-field">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  );
}
