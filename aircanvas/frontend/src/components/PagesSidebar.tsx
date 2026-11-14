import { memo, useEffect, useRef, useState } from 'react';
import { Plus, Copy, Trash2, Pencil, Layers, ChevronLeft, ArrowUpRight } from 'lucide-react';
import type { Editor } from '../storage/pageStore';
import type { Page } from '../types';
import { renderStrokes } from '../canvas/canvasRenderer';
import { contentBounds } from '../canvas/strokeEngine';
import { fitBounds } from '../canvas/coordinateTransforms';
const Thumbnail = memo(function Thumbnail({ page, revision }: { page: Page; revision: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const b = contentBounds(page.strokes);
    if (b) renderStrokes(ctx, page.strokes, fitBounds(b, c.width, c.height, 20), c.width, c.height);
  }, [page, revision]);
  return <canvas ref={ref} width={360} height={190} />;
});
export function PagesSidebar({
  editor,
  open,
  close,
  onDelete,
}: {
  editor: Editor;
  open: boolean;
  close: () => void;
  onDelete: (id: string) => void;
}) {
  const [rename, setRename] = useState<string | null>(null),
    [name, setName] = useState('');
  const commit = () => {
    if (rename) editor.rename(rename, name);
    setRename(null);
  };
  return (
    <aside
      className={`pages-panel glass ${open ? 'is-open' : ''}`}
      aria-label="Pages"
      aria-hidden={!open}
      inert={!open}
      data-ui
    >
      <div className="panel-heading">
        <div>
          <Layers size={17} />
          <strong>Your pages</strong>
          <span>{editor.state.pages.length.toString().padStart(2, '0')}</span>
        </div>
        <button className="icon-button" aria-label="Close pages" onClick={close}>
          <ChevronLeft size={17} />
        </button>
      </div>
      <div className="page-list">
        {editor.state.pages.map((page, i) => (
          <article
            className={`page-card ${page.id === editor.page.id ? 'selected' : ''}`}
            key={page.id}
          >
            <button
              className="page-thumbnail"
              aria-label={`Open ${page.name}`}
              onClick={() => editor.switchPage(page.id)}
            >
              <Thumbnail page={page} revision={page.revision} />
              {page.strokes.length === 0 && (
                <span className="blank-thumbnail">
                  <PenLineMini />A little space for big ideas
                </span>
              )}
              <span className="page-number">{String(i + 1).padStart(2, '0')}</span>
              {page.id === editor.page.id && <span className="page-active-dot" />}
            </button>
            <div className="page-name-row">
              {rename === page.id ? (
                <input
                  aria-label="Page name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setRename(null);
                  }}
                />
              ) : (
                <button className="page-name" onClick={() => editor.switchPage(page.id)}>
                  {page.name}
                </button>
              )}
              <ArrowUpRight size={13} />
            </div>
            <div className="page-meta">
              <span>
                {page.strokes.length} {page.strokes.length === 1 ? 'stroke' : 'strokes'}
              </span>
              <div>
                <button
                  aria-label={`Rename ${page.name}`}
                  title="Rename"
                  onClick={() => {
                    setRename(page.id);
                    setName(page.name);
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  aria-label={`Duplicate ${page.name}`}
                  title="Duplicate"
                  onClick={() => editor.duplicate(page.id)}
                >
                  <Copy size={13} />
                </button>
                <button
                  aria-label={`Delete ${page.name}`}
                  title="Delete"
                  onClick={() => onDelete(page.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <button className="add-page" onClick={() => editor.addPage()}>
        <Plus size={17} />
        New page<span>+</span>
      </button>
      <div className="sidebar-note">
        <span className="local-dot" />
        Your ideas stay on this device.
      </div>
    </aside>
  );
}
function PenLineMini() {
  return (
    <svg width="35" height="25" viewBox="0 0 35 25" fill="none">
      <path
        d="M3 19C7 8 12 4 13 9C14 14 8 23 11 21C14 19 21 7 22 8C23 9 14 23 21 17C27 12 30 13 32 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
