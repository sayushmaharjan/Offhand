import { useState } from 'react';
import { Download, FileImage, Video, Check, ArrowUpRight } from 'lucide-react';
import { Modal } from './Modal';
import { exportPNG } from '../export/pngExporter';
import type { Editor } from '../storage/pageStore';
export function ExportDialog({
  editor,
  video,
  connected,
  onClose,
}: {
  editor: Editor;
  video: HTMLVideoElement;
  connected: boolean;
  onClose: () => void;
}) {
  const [background, setBackground] = useState<'white' | 'camera'>('white'),
    [scope, setScope] = useState<'viewport' | 'all'>('all'),
    [scale, setScale] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  async function download() {
    setBusy(true);
    setError('');
    try {
      editor.end();
      await exportPNG(
        editor.page,
        {
          background,
          scope: background === 'camera' ? 'viewport' : scope,
          scale,
          width: editor.size.width,
          height: editor.size.height,
          overlayOpacity: editor.settings.overlayOpacity,
        },
        video,
      );
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Take your ideas with you."
      subtitle="A clean PNG, just the way you want it."
      onClose={onClose}
    >
      <div className="export-choices">
        <button
          className={background === 'white' ? 'selected' : ''}
          onClick={() => {
            setBackground('white');
            setDone(false);
          }}
        >
          <div className="export-tile white-tile">
            <FileImage size={32} />
          </div>
          <strong>White canvas</strong>
          <span>Your ink. A fresh background.</span>
          {background === 'white' && <Check className="choice-check" size={16} />}
        </button>
        <button
          disabled={!connected}
          className={background === 'camera' ? 'selected' : ''}
          onClick={() => {
            setBackground('camera');
            setDone(false);
          }}
        >
          <div className="export-tile camera-tile">
            <Video size={32} />
          </div>
          <strong>Camera background</strong>
          <span>
            {connected ? 'Keep the moment in the frame.' : 'Enable your camera to use this.'}
          </span>
          {background === 'camera' && <Check className="choice-check" size={16} />}
        </button>
      </div>
      <div className="form-row">
        <label htmlFor="export-area">Export area</label>
        <select
          id="export-area"
          value={background === 'camera' ? 'viewport' : scope}
          disabled={background === 'camera'}
          onChange={(e) => setScope(e.target.value as typeof scope)}
        >
          <option value="all">All drawing content</option>
          <option value="viewport">Current visible view</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="export-resolution">Resolution</label>
        <select
          id="export-resolution"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
        >
          <option value="1">Standard · 1×</option>
          <option value="2">High resolution · 2×</option>
          <option value="3">Extra high · 3×</option>
        </select>
      </div>
      <div className="export-note">
        <ArrowUpRight size={15} />
        No toolbars, pointers or tracking indicators. Just your work.
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <span>PNG image · {editor.page.name}</span>
        <button className="button primary" disabled={busy} onClick={download}>
          {done ? <Check size={16} /> : <Download size={16} />}
          {busy ? 'Creating PNG…' : done ? 'Download again' : 'Download PNG'}
        </button>
      </footer>
    </Modal>
  );
}
