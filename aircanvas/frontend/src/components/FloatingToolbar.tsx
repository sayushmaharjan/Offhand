import { PenLine, Eraser, Hand, Highlighter, Trash2, Plus } from 'lucide-react';
import type { Editor } from '../storage/pageStore';
const colors = ['#20252b', '#ffffff', '#ef6157', '#477de9', '#398169', '#e9ba40', '#9762cf'];
export function FloatingToolbar({ editor, onClear }: { editor: Editor; onClear: () => void }) {
  const s = editor.settings;
  return (
    <aside className="drawing-dock glass" aria-label="Drawing tools" data-ui>
      <span className="dock-caption">TOOLS</span>
      <div className="tool-buttons">
        {(
          [
            { id: 'pen', label: 'Pen (B)', Icon: PenLine },
            { id: 'highlighter', label: 'Highlighter', Icon: Highlighter },
            { id: 'eraser', label: 'Eraser (E)', Icon: Eraser },
            { id: 'hand', label: 'Hand tool (H)', Icon: Hand },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            title={label}
            aria-label={label}
            aria-pressed={s.tool === id}
            onClick={() => editor.configure({ tool: id })}
          >
            <Icon size={21} />
          </button>
        ))}
      </div>
      <div className="dock-divider" />
      <span className="dock-caption">COLOR</span>
      <div className="swatches">
        {colors.map((color, i) => (
          <button
            key={color}
            aria-label={`${['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple'][i]} ink`}
            title={color}
            aria-pressed={s.color === color}
            className="swatch"
            style={{ background: color }}
            onClick={() => editor.configure({ color })}
          />
        ))}
        <label className="custom-color" title="Custom color">
          <Plus size={15} />
          <input
            aria-label="Custom ink color"
            type="color"
            value={s.color}
            onChange={(e) => editor.configure({ color: e.target.value })}
          />
        </label>
      </div>
      <div className="dock-divider" />
      <span className="dock-caption">SIZE</span>
      <div className="brush-preview">
        <span
          style={{
            width: s.width,
            height: s.width,
            background: s.color === '#ffffff' ? '#ccc' : s.color,
          }}
        />
      </div>
      <input
        className="weight-slider"
        aria-label="Brush width"
        type="range"
        min="1"
        max="30"
        value={s.width}
        onChange={(e) => editor.configure({ width: Number(e.target.value) })}
      />
      <span className="brush-size">
        {s.width}
        <small> px</small>
      </span>
      <div className="dock-divider" />
      <button
        className="icon-button clear-button"
        aria-label="Clear page"
        title="Clear page"
        onClick={onClear}
      >
        <Trash2 size={18} />
      </button>
    </aside>
  );
}
