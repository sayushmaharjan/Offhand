import { useEffect, useRef } from 'react';
import type { Editor } from '../storage/pageStore';
import type { Feedback, XY } from '../types';
import { CanvasRenderer } from '../canvas/canvasRenderer';
import { zoomAt } from '../canvas/coordinateTransforms';
import { VideoSurface } from './CameraPreview';
export function CanvasWorkspace({
  editor,
  stream,
  feedback,
  onInteract,
}: {
  editor: Editor;
  stream: MediaStream | null;
  feedback: Feedback;
  onInteract: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    space = useRef(false),
    pointers = useRef(new Map<number, XY>()),
    pan = useRef<XY | null>(null),
    pinch = useRef<{ distance: number; center: XY } | null>(null);
  useEffect(() => {
    const canvas = ref.current!,
      renderer = new CanvasRenderer();
    let frame = 0,
      lastDpr = 0;
    const resize = () => {
      editor.end();
      editor.size = { width: window.innerWidth, height: window.innerHeight };
      editor.dirty = true;
    };
    resize();
    const draw = () => {
      if (editor.dirty || lastDpr !== devicePixelRatio) {
        renderer.render(
          canvas,
          editor.page,
          editor.live,
          editor.settings.grid,
          editor.size.width,
          editor.size.height,
        );
        editor.dirty = false;
        lastDpr = devicePixelRatio;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      editor.end();
      if (e.shiftKey && !e.ctrlKey) editor.pan(-e.deltaX, -e.deltaY);
      else
        editor.zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), {
          x: e.clientX,
          y: e.clientY,
        });
    };
    const keyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input,select,textarea')) {
          space.current = true;
          e.preventDefault();
        }
      },
      keyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') space.current = false;
      },
      blur = () => {
        editor.end();
        pointers.current.clear();
        pan.current = null;
        pinch.current = null;
        space.current = false;
      };
    canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    };
  }, [editor]);
  const end = (id: number) => {
    pointers.current.delete(id);
    editor.end();
    pan.current = null;
    pinch.current = null;
  };
  const s = editor.settings;
  return (
    <main className="workspace" aria-label="Infinite whiteboard">
      {s.overlay && stream && (
        <div className="camera-background">
          <VideoSurface stream={stream} />
          <div style={{ background: `rgba(255,255,255,${s.overlayOpacity})` }} />
        </div>
      )}
      <canvas
        ref={ref}
        data-testid="whiteboard"
        aria-label="Drawing canvas"
        className={`drawing-canvas cursor-${s.tool}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          onInteract();
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, p);
          if (pointers.current.size === 2) {
            editor.end();
            const [a, b] = [...pointers.current.values()];
            pinch.current = {
              distance: Math.hypot(a.x - b.x, a.y - b.y),
              center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            };
            return;
          }
          if (e.button === 1 || e.button === 2 || space.current || s.tool === 'hand') {
            editor.end();
            pan.current = p;
          } else if (s.mode === 'mouse') editor.begin({ ...p, t: performance.now() });
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const p = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, p);
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()],
              distance = Math.hypot(a.x - b.x, a.y - b.y),
              center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const old = pinch.current,
              v = zoomAt(editor.page.viewport, old.center, distance / Math.max(1, old.distance));
            editor.viewport({
              ...v,
              x: v.x + center.x - old.center.x,
              y: v.y + center.y - old.center.y,
            });
            pinch.current = { distance, center };
          } else if (pan.current) {
            editor.pan(p.x - pan.current.x, p.y - pan.current.y);
            pan.current = p;
          } else if (s.mode === 'mouse') {
            const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
            for (const event of events)
              editor.append({ x: event.clientX, y: event.clientY, t: event.timeStamp });
          }
        }}
        onPointerUp={(e) => end(e.pointerId)}
        onPointerCancel={(e) => end(e.pointerId)}
        onLostPointerCapture={(e) => end(e.pointerId)}
      />
      {editor.page.strokes.length === 0 && !editor.live && (
        <div className="canvas-welcome">
          <div className="welcome-kicker">
            <span />A LITTLE SPACE TO THINK BIG
          </div>
          <h1>
            Make room for
            <br />
            <em>your next idea.</em>
          </h1>
          <p>
            {s.mode === 'mouse'
              ? 'Pick a color. Make your first mark.'
              : 'Pinch to draw. Open your other palm, then close to pan.'}
            <br />
            {s.mode === 'mouse'
              ? 'Or turn on your camera and draw in the air.'
              : 'Let your hands do the thinking.'}
          </p>
          <svg
            className="welcome-scribble"
            width="166"
            height="42"
            viewBox="0 0 166 42"
            fill="none"
          >
            <path
              d="M4 27C35 4 81 3 68 15C55 27 24 40 49 29C74 18 124 4 114 14C104 24 72 40 97 29C120 19 143 17 161 22"
              stroke="#a4b68d"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span className="welcome-shortcuts">
            <kbd>B</kbd> pen <span>·</span> <kbd>H</kbd> pan <span>·</span> scroll to zoom
          </span>
        </div>
      )}
      {s.feedback && s.mode !== 'mouse' && feedback.pointer && (
        <>
          <svg className="pointer-trail">
            <polyline
              points={feedback.trail.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              opacity="0.2"
            />
          </svg>
          <div
            className={`air-pointer ${feedback.drawing ? 'is-down' : ''}`}
            style={{
              left: feedback.pointer.x,
              top: feedback.pointer.y,
              borderColor: s.color,
              background: feedback.drawing ? s.color : 'transparent',
            }}
          >
            <span>{feedback.drawing ? 'Drawing' : 'Hover'}</span>
          </div>
        </>
      )}
    </main>
  );
}
