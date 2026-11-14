import {
  Menu,
  Download,
  Settings2,
  MousePointer2,
  Hand,
  PenLine,
  Check,
  LoaderCircle,
} from 'lucide-react';
import type { InputMode } from '../types';
export function TopBar({
  mode,
  setMode,
  togglePages,
  exportPage,
  settings,
  saveStatus,
}: {
  mode: InputMode;
  setMode: (m: InputMode) => void;
  togglePages: () => void;
  exportPage: () => void;
  settings: () => void;
  saveStatus: string;
}) {
  return (
    <header className="topbar glass" data-ui>
      <div className="brand-group">
        <button
          className="icon-button"
          title="Toggle pages"
          aria-label="Toggle pages"
          onClick={togglePages}
        >
          <Menu size={20} />
        </button>
        <div className="brand-mark">
          <PenLine size={22} />
        </div>
        <div className="brand">
          <strong>
            AirCanvas<span>®</span>
          </strong>
          <small>ROOM FOR EVERY IDEA</small>
        </div>
        <span className={`save-status ${saveStatus.includes('failed') ? 'error-text' : ''}`}>
          {saveStatus === 'Saved locally' ? <Check size={13} /> : <LoaderCircle size={13} />}
          <span>{saveStatus}</span>
        </span>
      </div>
      <div className="mode-switch" aria-label="Input mode">
        {(
          [
            { id: 'mouse', label: 'Mouse', Icon: MousePointer2 },
            { id: 'finger', label: 'Air draw', Icon: Hand },
            { id: 'pen', label: 'Stylus', Icon: PenLine },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-label={label}
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="top-actions">
        <button
          className="icon-button"
          aria-label="Settings"
          title="Settings & calibration"
          onClick={settings}
        >
          <Settings2 size={19} />
        </button>
        <button className="button primary" aria-label="Export" onClick={exportPage}>
          <Download size={16} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}
