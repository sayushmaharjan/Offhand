# Offhand

A local, webcam-controlled infinite whiteboard. Draw with a mouse, your index finger, or a pen with a colored marker. Your handwriting stays as editable vector strokes; there is no OCR or cloud vision service.

The complete application is in [`aircanvas/frontend`](aircanvas/frontend). The optional colored-marker service is in [`aircanvas/backend`](aircanvas/backend). `instructions.md` is the original product brief.

## Run it

From this workspace:

```sh
python3 main.py
```

Open **http://127.0.0.1:5173**. The launcher uses the project-local Node.js runtime installed during setup if Node is not on your PATH. Python here is only a convenient launcher; finger mode needs no Python service.

On another computer, install **Node.js 22.12 or newer**, then:

```sh
cd aircanvas/frontend
npm ci
npm run dev
```

Installation downloads the official MediaPipe hand model once and copies the matching WebAssembly runtime into `public/`. Camera processing then uses locally served assets. If that download is interrupted, run `npm run assets`. Internet access is needed for dependency/model installation, not for runtime vision processing.

Use a recent browser with WebAssembly, Canvas, IndexedDB, and webcam support. Camera permission requires **localhost or HTTPS**. Begin in Mouse mode, which works even when no camera is connected or the model fails.

## Use the canvas

- **Mouse:** drag to draw; choose pen, highlighter, eraser, or hand in the right dock. The eraser removes entire strokes. Brush widths are 1–30 world units.
- **Pan:** select Hand, hold Space and drag, use the middle/right mouse button, or Shift + scroll. Two-finger touch gestures pan and zoom.
- **Zoom:** scroll, use a trackpad pinch, press `+`/`−`, or use the bottom-right controls. Fit centers all content; Reset returns to 100% at the origin.
- **Pages:** use the hamburger button. Add, rename, duplicate, delete, or switch pages. Every page has independent ink, view, and undo/redo stacks. Deletion asks for confirmation.
- **History:** `Ctrl/Cmd Z` undoes; `Ctrl/Cmd Shift Z` or `Ctrl Y` redoes. Up to 80 edits are retained per page during a session. Clear is undoable.
- **Tools:** `B` selects the pen, `E` the eraser, and `H` the hand tool. `Ctrl/Cmd S` opens PNG export.

## Air drawing

Select **Air draw**, enable the camera, and follow the eight-step hand check. Setup observes real detections before marking a step complete. You can skip setup and revisit it in Settings.

1. Move your **right index fingertip** to hover. Pinch the thumb and index finger to draw; release to end the stroke.
2. Show your **left open palm** to arm navigation. Close it into a fist to grab, then move the fist to pan. Open it to release.
3. Panning takes priority over writing. Release and re-pinch after a grab or menu interaction to resume writing.

Settings allow swapping writing/navigation hands, selecting the alternate extended-index gesture, adjusting confidence, smoothing, pinch threshold, pointer sensitivity, and grab sensitivity. Keep pointer sensitivity at **1** for exact fingertip-to-camera alignment. If the model identifies your physical hands incorrectly, use **Invert model hand labels** during calibration.

The mirrored camera background uses `object-fit: cover`; tracking and exports use the same crop and aspect-ratio calculation. You can keep a small camera preview or enable a full camera overlay and adjust its whiteboard opacity. Tracking feedback is optional and never exported.

A new pinch requires two stable detections; release and tracking loss stop ink immediately. Sudden position jumps, stale detections, hidden tabs, modal dialogs, and pointers over controls also interrupt writing. A new stroke is used after a tracking gap.

## Optional pen/stylus mode

Use **Python 3.11+**. From the repository root:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r aircanvas/backend/requirements.txt
python -m uvicorn aircanvas.backend.main:app --host 127.0.0.1 --port 8000
```

This workspace already has a prepared environment, so you can run:

```sh
.venv/bin/python -m uvicorn aircanvas.backend.main:app --host 127.0.0.1 --port 8000
```

Keep the frontend running in another terminal. Add a small, bright, saturated colored marker near the pen tip. Choose **Stylus**, open Settings, click the marker in the mirrored calibration preview, and adjust HSV tolerance if needed. Avoid similarly colored objects in the background. A marker provides its centroid, not an exact unmarked pen-tip location; place it as close to the tip as practical.

`aircanvas/backend/requirements.lock.txt` records the exact Python package versions used for validation; install it instead of `requirements.txt` to reproduce that environment.

Pen-down is explicit:

| Navigation hand / keyboard | Result |
| --- | --- |
| Pinch held | Draw while the marker is reliably detected |
| Open palm | Pen up; also clears the keyboard drawing toggle |
| Open palm, then fist | Grab and pan; drawing is suppressed |
| `D` | Toggle drawing as a keyboard fallback |
| Missing or ambiguous marker | End the current stroke |

Frames travel only to `127.0.0.1:8000`, with one marker request in flight. The service rejects browser origins other than the local dev/preview frontend, keeps frames in memory only, and binds to loopback by default. Finger mode never contacts it. Generic object detection is not used. `PenTipTracker` and `PenTipDetector` provide replaceable interfaces for a future custom local keypoint model.

## Save and export

Pages, strokes, viewport transforms, tools, colors, brush width, and calibration settings autosave to **IndexedDB**, debounced by 500 ms. The editor restores them on reload and starts in Mouse mode so it does not activate a camera unexpectedly. Undo/redo history is session-local. Camera frames and recordings are never saved.

**Export** offers:

- White-background PNG: current viewport or all drawing bounds with padding.
- Camera-background PNG: a mirrored snapshot of the current viewport, including the configured whiteboard opacity and aligned ink.
- Standard 1×, high 2×, and extra-high 3× resolution. Very large images are rejected with a recovery message to avoid browser allocation failures.

PNG generation uses a separate canvas and `toBlob()`. It excludes the grid, UI, cursors, and feedback. Filenames use the page name and the browser's local date.

Settings also provide **Export project / Import project** as portable JSON. Import validates coordinates, sizes, settings, and page identifiers before asking to replace the workspace. Export a project before clearing browser storage or moving computers. If local storage becomes unavailable or full, the app reports it and you can still export.

## Architecture

```text
aircanvas/
  frontend/
    src/
      components/   Floating controls, pages, canvas, dialogs, camera preview
      canvas/       World transforms, smoothing, cached rendering, erasing
      tracking/     MediaPipe worker, gestures, identity, pan state, marker adapter
      hooks/        Camera lifecycle and bounded tracking loops
      storage/      Editor/history, import validation, IndexedDB
      export/       Offscreen PNG rendering
      styles/       Responsive Tailwind/CSS interface
    scripts/        Local MediaPipe asset preparation
    tests/          Synthetic gesture/unit tests and real-browser tests
  backend/
    detection/      OpenCV HSV marker detection and calibration
    tests/          Synthetic image and HTTP endpoint tests
```

The renderer implements `screen = world × zoom + pan`. Ink is always stored in world coordinates with time-stamped points, color, width, opacity, and bounds. One Euro filtering adapts to movement speed; midpoint quadratic curves and round caps smooth the rendering without text substitution. Committed strokes are cached in a canvas layer and culled by visible bounds. Only the active stroke is redrawn continuously. Camera inference is separated from rendering, targets 24 updates/second, skips duplicate video frames, and allows one in-flight frame.

MediaPipe runs in a worker with GPU/CPU initialization where supported, and falls back to throttled main-thread CPU inference. Input is mirrored once before detection. Identity association uses model handedness and recent trajectory rather than screen side. Navigation follows `IDLE → PALM_VISIBLE → GRABBING → DRAGGING → RELEASED`, with filtering, tremor deadband, stable activation, and immediate loss/release handling.

## Build and tests

```sh
cd aircanvas/frontend
npm run build
npm test
npm run test:e2e
```

Browser tests use installed **Google Chrome** through Playwright. To use downloaded Chromium instead, remove `channel: 'chrome'` in `playwright.config.ts`, then run `npx playwright install chromium`. The test runner starts and stops its own localhost server.

From the repository root:

```sh
.venv/bin/python -m pytest aircanvas/backend/tests -q
```

Coverage includes unpinched hover, stable pinch/release, tracking loss, independent simultaneous hands, open/fist pan transitions, zoomed drawing, preserved coordinates, page isolation, undo/redo, erasing, brush widths, mirror/crop mapping, marker loss, camera failure recovery, autosave restoration, portable export, responsive controls, and pixel comparisons for white and camera PNGs. A browser test loads the actual local MediaPipe model on synthetic video; backend tests use generated colored-marker images.

**Physical webcam gesture recognition and real pen tracking have not been validated on hardware.** Lighting, hand orientation, occlusion, camera placement, and device performance affect recognition. The detector is a practical heuristic implementation, not a guarantee of handwriting accuracy or 24 fps on every laptop. Browser tests and synthetic gestures verify software behavior, not real-world gesture quality. Start with good lighting, hands separated, and the calibration flow.

## Troubleshooting

| Symptom | Recovery |
| --- | --- |
| Permission denied or no webcam | Allow camera access in browser settings, connect a webcam, and retry; Mouse mode remains available. |
| Camera disconnected | Disconnect/reconnect in the UI after reconnecting the hardware. |
| Model loading fails | Run `npm run assets`, restart the dev server, and toggle camera/mode to retry. |
| Pointer seems offset | Set sensitivity to 1; verify hand labels during calibration; the camera overlay intentionally crops to fill the window. |
| Pinch misses or activates too easily | Adjust pinch sensitivity and confidence; keep thumb/index visible. |
| Fist does not pan | First show an open palm for a moment; then close it and move. Re-arm after tracking loss. |
| Marker tracker offline | Start the Python server on port 8000; ensure the frontend uses localhost port 5173 or preview port 4173. |
| Marker jumps or disappears | Recalibrate its color, improve lighting, and remove competing colored objects. Ambiguous detections intentionally pause ink. |
| Storage error | Download a project JSON immediately, then free browser storage or choose another browser profile. |
| PNG too large | Choose standard resolution or export the visible viewport. |

For a production static build, serve `aircanvas/frontend/dist` over HTTPS (or localhost). It includes the vision model and WASM files. Hosted pen mode would need an explicitly designed local companion connection; the provided marker adapter is intended for local development.

References: [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web), [video inference API](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.handlandmarker).
