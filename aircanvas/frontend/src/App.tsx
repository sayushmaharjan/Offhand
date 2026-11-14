import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Undo2,
  Redo2,
  Minus,
  Plus,
  Maximize,
  RotateCcw,
  MousePointer2,
  Hand,
  Video,
  Info,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { Editor } from './storage/pageStore';
import {
  loadWorkspace,
  saveWorkspace,
  portableWorkspace,
  validateWorkspace,
} from './storage/indexedDB';
import { downloadBlob } from './export/pngExporter';
import { AirController } from './tracking/fingerPointer';
import { useCamera } from './hooks/useCamera';
import { useTracking } from './hooks/useTracking';
import { TopBar } from './components/TopBar';
import { FloatingToolbar } from './components/FloatingToolbar';
import { PagesSidebar } from './components/PagesSidebar';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { CameraPreview } from './components/CameraPreview';
import { ExportDialog } from './components/ExportDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { CalibrationDialog } from './components/CalibrationDialog';
import { Modal } from './components/Modal';
import type { InputMode, Workspace } from './types';
export default function App() {
  const [editor] = useState(() => new Editor()),
    [air] = useState(() => new AirController(editor));
  useSyncExternalStore(editor.subscribe, editor.snapshot);
  const [loaded, setLoaded] = useState(false),
    [saveStatus, setSaveStatus] = useState('Opening workspace…'),
    [sidebar, setSidebar] = useState(() => innerWidth >= 900),
    [dialog, setDialog] = useState<'export' | 'settings' | 'calibration' | null>(null),
    [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void } | null>(
      null,
    ),
    [notice, setNotice] = useState(''),
    [interacted, setInteracted] = useState(false);
  const saving = useRef<Promise<void>>(Promise.resolve()),
    storageReady = useRef(false),
    lastSaved = useRef('');
  const stopAir = useCallback(() => air.stop(), [air]);
  const camera = useCamera(stopAir);
  const tracking = useTracking(
    editor,
    air,
    camera.video,
    camera.status === 'connected',
    !!dialog || !!confirm || !loaded,
  );
  useEffect(() => {
    let live = true;
    loadWorkspace()
      .then((state) => {
        if (!live) return;
        if (state) {
          state.settings.mode = 'mouse';
          editor.restore(state);
        }
        storageReady.current = true;
        lastSaved.current = JSON.stringify(portableWorkspace(editor.state));
        setSaveStatus('Saved locally');
      })
      .catch((e) => {
        if (live) {
          setNotice(`Autosave could not open: ${e.message} Export a project to keep a copy.`);
          setSaveStatus('Storage unavailable');
        }
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [editor]);
  useEffect(() => {
    if (!loaded) return;
    let timer: ReturnType<typeof setTimeout>;
    const persist = () => {
      if (!storageReady.current) return;
      const copy = structuredClone(portableWorkspace(editor.state)),
        serialized = JSON.stringify(copy);
      if (serialized === lastSaved.current) return;
      setSaveStatus('Saving…');
      saving.current = saving.current
        .catch(() => {})
        .then(() => saveWorkspace(copy))
        .then(() => {
          lastSaved.current = serialized;
          setSaveStatus('Saved locally');
        })
        .catch(() => {
          setSaveStatus('Save failed');
          setNotice(
            'Local storage is full or unavailable. Export your project now to keep your drawings.',
          );
        });
    };
    const unsubscribe = editor.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(persist, 500);
    });
    const flush = () => {
      editor.end();
      clearTimeout(timer);
      persist();
    };
    const visibility = () => {
      if (document.hidden) {
        air.stop();
        flush();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', flush);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [loaded, editor, air]);
  const close = useCallback(() => {
    air.stop();
    setDialog(null);
  }, [air]);
  const open = useCallback(
    (next: typeof dialog) => {
      editor.end();
      air.stop();
      setDialog(next);
    },
    [editor, air],
  );
  const mode = useCallback(
    (next: InputMode) => {
      air.stop();
      editor.configure({ mode: next });
      if (next !== 'mouse' && !editor.settings.calibrated) open('calibration');
      if (next !== 'mouse') void camera.start();
    },
    [air, editor, open, camera.start],
  );
  const startCamera = () => {
    if (editor.settings.mode === 'mouse') editor.configure({ mode: 'finger' });
    if (!editor.settings.calibrated) open('calibration');
    void camera.start();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable="true"]') ||
        dialog ||
        confirm
      )
        return;
      const k = e.key.toLowerCase(),
        cmd = e.metaKey || e.ctrlKey;
      if (cmd && k === 'z') {
        e.preventDefault();
        air.stop();
        e.shiftKey ? editor.redo() : editor.undo();
        return;
      }
      if (cmd && k === 's') {
        e.preventDefault();
        open('export');
        return;
      }
      if (cmd && k === 'y') {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (cmd) return;
      if (e.repeat) return;
      if (['b', 'e', 'h'].includes(k)) {
        air.stop();
        editor.configure({ tool: k === 'b' ? 'pen' : k === 'e' ? 'eraser' : 'hand' });
      }
      if (k === '+' || k === '=') {
        e.preventDefault();
        air.stop();
        editor.zoom(1.2);
      }
      if (k === '-') {
        e.preventDefault();
        air.stop();
        editor.zoom(1 / 1.2);
      }
      if (k === 'd' && editor.settings.mode === 'pen') {
        air.keyboardDown = !air.keyboardDown;
        if (!air.keyboardDown) editor.end();
      }
      if (k === 'escape') {
        air.stop();
        editor.end();
      }
    };
    const blur = () => air.stop();
    window.addEventListener('keydown', key);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', blur);
    };
  }, [editor, air, dialog, confirm, open]);
  function exportProject() {
    editor.end();
    downloadBlob(
      new Blob([JSON.stringify(portableWorkspace(editor.state))], { type: 'application/json' }),
      'AirCanvas_project.json',
    );
  }
  async function importProject(file: File) {
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a project smaller than 50 MB.');
      const state: Workspace = validateWorkspace(JSON.parse(await file.text()));
      setConfirm({
        title: 'Open this project?',
        message:
          'This replaces the current workspace. Export your current project first if you want to keep a separate copy.',
        action: () => {
          air.stop();
          state.settings.mode = 'mouse';
          editor.restore(state);
          setDialog(null);
        },
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'This project could not be opened.');
    }
  }
  const feedback = tracking.feedback,
    s = editor.settings;
  return (
    <div
      onPointerDownCapture={(event) => {
        if ((event.target as HTMLElement).closest('[data-ui]')) air.stop();
      }}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('[data-ui]')) air.stop();
      }}
    >
      <CanvasWorkspace
        editor={editor}
        stream={camera.stream}
        feedback={feedback}
        onInteract={() => setInteracted(true)}
      />
      <TopBar
        mode={s.mode}
        setMode={mode}
        togglePages={() => setSidebar(!sidebar)}
        exportPage={() => open('export')}
        settings={() => open('settings')}
        saveStatus={saveStatus}
      />
      <PagesSidebar
        editor={editor}
        open={sidebar}
        close={() => setSidebar(false)}
        onDelete={(id) =>
          setConfirm({
            title: 'Delete this page?',
            message:
              'This page and its drawing history will be removed. Your other pages will stay as they are.',
            action: () => editor.deletePage(id),
          })
        }
      />
      <FloatingToolbar
        editor={editor}
        onClear={() =>
          setConfirm({
            title: 'Start with a clean page?',
            message: 'Clear all strokes on this page. You can undo this action.',
            action: () => editor.clear(),
          })
        }
      />
      <CameraPreview
        stream={camera.stream}
        status={camera.status}
        connect={startCamera}
        stop={camera.stop}
        overlay={s.overlay}
        toggleOverlay={() => editor.configure({ overlay: !s.overlay })}
        visible={s.preview}
      />
      <div className="canvas-label" data-ui>
        <span className="status-dot online" />
        {editor.page.name}
        <span className="label-divider" />
        INFINITE CANVAS
      </div>
      <div className="bottom-center" data-ui>
        <div className="history-toolbar glass">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (⌘/Ctrl Z)"
            disabled={!editor.page.undo.length}
            onClick={() => {
              air.stop();
              editor.undo();
            }}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (⇧ ⌘/Ctrl Z)"
            disabled={!editor.page.redo.length}
            onClick={() => {
              air.stop();
              editor.redo();
            }}
          >
            <Redo2 size={18} />
          </button>
          <span />
          <div className="current-mode">
            {s.mode === 'mouse' ? <MousePointer2 size={15} /> : <Hand size={16} />}
            <span>
              {s.mode === 'mouse'
                ? 'Mouse mode'
                : feedback.drawing
                  ? 'Drawing'
                  : feedback.pan === 'DRAGGING'
                    ? 'Panning'
                    : feedback.pan === 'GRABBING'
                      ? 'Canvas grabbed'
                      : s.mode === 'pen'
                        ? 'Marker mode'
                        : 'Air draw mode'}
            </span>
            <i className={feedback.drawing ? 'active' : ''} />
          </div>
        </div>
        <p className="bottom-hint">
          {s.mode === 'mouse'
            ? 'Hold space to pan · Scroll to zoom'
            : s.mode === 'pen'
              ? 'Pinch with navigation hand or press D to draw'
              : 'Pinch to draw · Open palm, then fist to pan'}
        </p>
      </div>
      <div className="zoom-toolbar glass" data-ui>
        <button
          className="icon-button"
          aria-label="Zoom out"
          onClick={() => {
            air.stop();
            editor.zoom(1 / 1.2);
          }}
        >
          <Minus size={16} />
        </button>
        <button
          className="zoom-value"
          title="Reset view"
          onClick={() => {
            air.stop();
            editor.viewport({ x: 0, y: 0, zoom: 1 });
          }}
        >
          {Math.round(editor.page.viewport.zoom * 100)}%
        </button>
        <button
          className="icon-button"
          aria-label="Zoom in"
          onClick={() => {
            air.stop();
            editor.zoom(1.2);
          }}
        >
          <Plus size={16} />
        </button>
        <span />
        <button
          className="icon-button"
          aria-label="Fit drawing"
          title="Fit drawing to view"
          onClick={() => {
            air.stop();
            editor.fit();
          }}
        >
          <Maximize size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Reset view"
          title="Reset view"
          onClick={() => {
            air.stop();
            editor.viewport({ x: 0, y: 0, zoom: 1 });
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      {s.feedback && s.mode !== 'mouse' && (
        <div className="tracking-status glass" data-ui>
          <span>
            <Video size={13} />
            {camera.status === 'connected'
              ? 'Camera connected'
              : camera.status === 'loading'
                ? 'Connecting…'
                : 'Camera off'}
          </span>
          <span className={feedback.writing ? 'is-tracked' : ''}>
            {s.writingHand} hand: {feedback.writing ? 'Tracking' : 'Waiting'}
          </span>
          <span className={feedback.navigation ? 'is-tracked' : ''}>
            {s.writingHand === 'Right' ? 'Left' : 'Right'} hand:{' '}
            {feedback.navigation ? 'Tracking' : 'Waiting'}
          </span>
          {feedback.pan !== 'IDLE' && (
            <span>Canvas: {feedback.pan.toLowerCase().replace('_', ' ')}</span>
          )}
          {tracking.status === 'Loading hand model…' && <span>{tracking.status}</span>}
          {feedback.warning && <small>{feedback.warning}</small>}
        </div>
      )}
      {!interacted && s.mode === 'mouse' && (
        <button className="air-invite glass" data-ui onClick={() => mode('finger')}>
          <span className="invite-icon">
            <Hand size={19} />
          </span>
          <div>
            <strong>A new way to make your mark</strong>
            <span>Try drawing with your hands</span>
          </div>
          <ArrowUpRight size={17} />
        </button>
      )}
      {(notice || camera.error || tracking.error) && (
        <div className="notice glass" role="alert" data-ui>
          <Info size={18} />
          <p>{notice || camera.error || tracking.error}</p>
          <button
            className="text-button"
            onClick={() => {
              if (notice) setNotice('');
              else {
                camera.stop();
                editor.configure({ mode: 'mouse' });
              }
            }}
          >
            {notice ? 'Dismiss' : 'Use mouse'}
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss notice"
            onClick={() => {
              setNotice('');
              if (camera.error || tracking.error) {
                camera.stop();
                editor.configure({ mode: 'mouse' });
              }
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {!loaded && (
        <div className="loading-screen" data-ui>
          Opening your canvas…
        </div>
      )}
      {dialog === 'export' && (
        <ExportDialog
          editor={editor}
          video={camera.video}
          connected={!!camera.stream}
          onClose={close}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          editor={editor}
          video={camera.video}
          stream={camera.stream}
          onClose={close}
          onCalibrate={() => {
            editor.configure({ mode: 'finger' });
            open('calibration');
          }}
          onExport={exportProject}
          onImport={importProject}
        />
      )}
      {dialog === 'calibration' && (
        <CalibrationDialog
          editor={editor}
          air={air}
          stream={camera.stream}
          cameraStatus={camera.status}
          connect={() => void camera.start()}
          error={camera.error || tracking.error}
          onClose={close}
        />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="confirm-copy">{confirm.message}</p>
          <footer className="modal-footer">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                air.stop();
                confirm.action();
                setConfirm(null);
              }}
            >
              Confirm
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
