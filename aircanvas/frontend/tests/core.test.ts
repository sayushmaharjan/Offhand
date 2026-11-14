import { describe, it, expect } from 'vitest';
import { Editor, newWorkspace } from '../src/storage/pageStore';
import {
  screenToWorld,
  worldToScreen,
  cameraToScreen,
  zoomAt,
} from '../src/canvas/coordinateTransforms';
import { GestureRecognizer, HandIdentityResolver } from '../src/tracking/gestureRecognizer';
import { GrabStateMachine } from '../src/tracking/gestureStateMachine';
import { AirController } from '../src/tracking/fingerPointer';
import { validateWorkspace } from '../src/storage/indexedDB';
import type { Hand, Gesture } from '../src/types';
const p = (x: number, y: number, t = 0) => ({ x, y, t });
function hand(label: Hand['label'], kind: 'open' | 'pinch' | 'fist' = 'open', dx = 0): Hand {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5 + dx, y: 0.8, z: 0 }));
  points[0] = { x: 0.5 + dx, y: 0.8, z: 0 };
  for (const [i, x] of [
    [5, 0.43],
    [9, 0.5],
    [13, 0.57],
    [17, 0.64],
  ]) {
    points[i] = { x: x + dx, y: 0.57, z: 0 };
    points[i + 1] = { x: x + dx, y: 0.43, z: 0 };
    points[i + 2] = { x: x + dx, y: 0.34, z: 0 };
    points[i + 3] = { x: x + dx, y: 0.25, z: 0 };
    if (kind === 'fist') {
      points[i + 1].y = 0.63;
      points[i + 2].y = 0.7;
      points[i + 3].y = 0.74;
    }
  }
  points[4] =
    kind === 'pinch'
      ? { x: points[8].x + 0.01, y: points[8].y, z: 0 }
      : { x: 0.24 + dx, y: 0.55, z: 0 };
  if (kind === 'fist') points[4] = { x: 0.4 + dx, y: 0.7, z: 0 };
  return { label, confidence: 0.99, points };
}
const video = { width: 1280, height: 720 };
const gesture = (kind: 'open' | 'fist' | 'pinch'): Gesture => ({
  open: kind === 'open',
  fist: kind === 'fist',
  pinch: kind === 'pinch',
  pointing: false,
  center: { x: 0, y: 0 },
  tip: { x: 0, y: 0 },
});
describe('World coordinates and continuous ink', () => {
  it('maps zoomed screen input into world coordinates without moving existing ink', () => {
    const e = new Editor();
    e.viewport({ x: 100, y: 50, zoom: 2 });
    e.begin(p(140, 90));
    e.append(p(180, 130, 16));
    e.end();
    expect(e.page.strokes[0].points[0]).toEqual(p(20, 20));
    const before = structuredClone(e.page.strokes);
    e.pan(50, -10);
    expect(e.page.strokes).toEqual(before);
    expect(worldToScreen(p(20, 20), e.page.viewport)).toEqual({ x: 190, y: 80 });
  });
  it('anchors zoom at the pointer and inverts transforms', () => {
    const v = { x: -91, y: 271, zoom: 2.5 },
      point = p(350, 200);
    expect(worldToScreen(screenToWorld(point, v), v)).toEqual({ x: 350, y: 200 });
    const next = zoomAt(v, point, 1.6);
    expect(screenToWorld(point, next).x).toBeCloseTo(screenToWorld(point, v).x);
    expect(screenToWorld(point, next).y).toBeCloseTo(screenToWorld(point, v).y);
  });
  it('preserves custom world-space width and smooth connected samples', () => {
    const e = new Editor();
    e.configure({ width: 21 });
    e.begin(p(20, 20));
    for (let i = 1; i <= 20; i++) e.append(p(20 + i * 5, 20 + Math.sin(i) * 3, i * 16));
    e.end();
    expect(e.page.strokes).toHaveLength(1);
    expect(e.page.strokes[0].points.length).toBeGreaterThan(15);
    expect(e.page.strokes[0].width).toBe(21);
  });
  it('ends on a tracking gap or teleport instead of connecting distant points', () => {
    const e = new Editor();
    e.begin(p(10, 10), 'air');
    e.append(p(20, 20, 40));
    e.append(p(1000, 600, 80));
    expect(e.active).toBe(false);
    expect(e.page.strokes[0].points.at(-1)!.x).toBeLessThan(30);
    e.begin(p(30, 30, 100), 'air');
    e.append(p(35, 35, 400));
    expect(e.active).toBe(false);
  });
  it('eraser removes a complete stroke and undo restores it', () => {
    const e = new Editor();
    e.begin(p(20, 20));
    e.append(p(90, 20, 16));
    e.end();
    e.configure({ tool: 'eraser' });
    e.begin(p(30, 20));
    e.end();
    expect(e.page.strokes).toHaveLength(0);
    e.undo();
    expect(e.page.strokes).toHaveLength(1);
  });
});
describe('Independent page history', () => {
  it('creates blank pages and preserves ink, transform, undo and redo on switching', () => {
    const e = new Editor(),
      first = e.page.id;
    e.begin(p(30, 40));
    e.end();
    e.pan(100, 60);
    e.addPage();
    const second = e.page.id;
    expect(e.page.strokes).toHaveLength(0);
    expect(e.page.viewport.zoom).toBe(1);
    expect(e.page.undo).toHaveLength(0);
    e.switchPage(first);
    expect(e.page.strokes).toHaveLength(1);
    expect(e.page.viewport.x).toBe(100);
    e.undo();
    expect(e.page.strokes).toHaveLength(0);
    e.switchPage(second);
    expect(e.page.redo).toHaveLength(0);
    e.switchPage(first);
    e.redo();
    expect(e.page.strokes).toHaveLength(1);
  });
  it('duplicates independent data and always retains one page', () => {
    const e = new Editor(),
      first = e.page.id;
    e.begin(p(10, 20));
    e.end();
    e.duplicate(first);
    expect(e.page.strokes[0]).not.toBe(e.state.pages[0].strokes[0]);
    e.clear();
    expect(e.state.pages[0].strokes).toHaveLength(1);
    e.deletePage(e.page.id);
    e.deletePage(first);
    expect(e.state.pages).toHaveLength(1);
  });
  it('rejects malformed imports before replacing a project', () => {
    const state = newWorkspace();
    state.pages[0].viewport.zoom = NaN;
    expect(() => validateWorkspace(state)).toThrow();
    expect(() => validateWorkspace({ version: 2, pages: [] })).toThrow();
  });
});
describe('Hand gestures and safety', () => {
  it('requires a stable pinch and releases immediately with hysteresis', () => {
    const r = new GestureRecognizer();
    expect(r.recognize(hand('Right', 'pinch'), 0.28).pinch).toBe(false);
    expect(r.recognize(hand('Right', 'pinch'), 0.28).pinch).toBe(true);
    expect(r.recognize(hand('Right'), 0.28).pinch).toBe(false);
  });
  it('does not draw for a moving unpinched finger', () => {
    const e = new Editor();
    e.configure({ mode: 'finger' });
    const air = new AirController(e);
    for (let i = 0; i < 10; i++) air.update([hand('Right', 'open', i * 0.01)], i * 40, video);
    expect(e.active).toBe(false);
    expect(e.page.strokes).toHaveLength(0);
  });
  it('writes continuously with pinch, ends on release, and starts a separate stroke after loss', () => {
    const e = new Editor();
    e.configure({ mode: 'finger' });
    const air = new AirController(e);
    for (let i = 0; i < 7; i++) air.update([hand('Right', 'pinch', i * 0.01)], i * 40, video);
    expect(e.live!.points.length).toBeGreaterThan(3);
    air.update([hand('Right', 'open', 0.07)], 280, video);
    expect(e.active).toBe(false);
    expect(e.page.strokes).toHaveLength(1);
    for (let i = 0; i < 4; i++)
      air.update([hand('Right', 'pinch', 0.08 + i * 0.01)], 320 + i * 40, video);
    air.update([], 480, video);
    expect(e.page.strokes).toHaveLength(2);
    for (let i = 0; i < 4; i++)
      air.update([hand('Right', 'pinch', -0.2 + i * 0.01)], 520 + i * 40, video);
    air.update([], 700, video);
    expect(e.page.strokes).toHaveLength(3);
    expect(e.page.strokes[2].points[0].x).toBeLessThan(350);
  });
  it('open palm never moves the canvas; open→fist→move pans; release stops', () => {
    const g = new GrabStateMachine();
    expect(g.update(gesture('open'), p(100, 100), 0)).toBeNull();
    g.update(gesture('open'), p(110, 100), 40);
    expect(g.state).toBe('PALM_VISIBLE');
    g.update(gesture('fist'), p(120, 100), 80);
    g.update(gesture('fist'), p(140, 100), 120);
    expect(g.state).toBe('GRABBING');
    expect(g.update(gesture('fist'), p(170, 90), 160)).toEqual({ x: 30, y: -10 });
    expect(g.state).toBe('DRAGGING');
    expect(g.update(gesture('open'), p(200, 90), 200)).toBeNull();
    expect(g.state).toBe('RELEASED');
    expect(g.update(gesture('open'), p(250, 90), 240)).toBeNull();
  });
  it('never grabs from an unarmed fist or reconnects a lost drag', () => {
    const g = new GrabStateMachine();
    for (let i = 0; i < 5; i++) expect(g.update(gesture('fist'), p(i * 40, 0), i * 40)).toBeNull();
    g.update(gesture('open'), p(0, 0), 220);
    g.update(gesture('open'), p(0, 0), 260);
    g.update(gesture('fist'), p(0, 0), 300);
    g.update(gesture('fist'), p(0, 0), 340);
    g.update(null, null, 380);
    expect(g.update(gesture('fist'), p(200, 0), 420)).toBeNull();
    expect(g.state).toBe('IDLE');
  });
  it('recognizes both hands independently and suppresses ink while grabbing at zoom', () => {
    const e = new Editor();
    e.configure({ mode: 'finger' });
    e.viewport({ zoom: 2, x: 0, y: 0 });
    const a = new AirController(e);
    a.update([hand('Right', 'pinch', 0.1), hand('Left', 'open', -0.25)], 0, video);
    a.update([hand('Right', 'pinch', 0.11), hand('Left', 'open', -0.25)], 40, video);
    expect(a.feedback.writing && a.feedback.navigation).toBe(true);
    a.update([hand('Right', 'pinch', 0.12), hand('Left', 'fist', -0.25)], 80, video);
    a.update([hand('Right', 'pinch', 0.13), hand('Left', 'fist', -0.25)], 120, video);
    expect(e.active).toBe(false);
    a.update([hand('Right', 'pinch', 0.14), hand('Left', 'fist', -0.21)], 160, video);
    expect(e.page.viewport.x).toBeGreaterThan(0);
    expect(e.page.viewport.x).toBeLessThanOrEqual(51.2);
    expect(e.active).toBe(false);
  });
  it('blocks menu ink until release and a fresh pinch', () => {
    const e = new Editor();
    e.configure({ mode: 'finger' });
    const a = new AirController(e);
    a.update([hand('Right', 'pinch')], 0, video, true);
    a.update([hand('Right', 'pinch')], 40, video);
    a.update([hand('Right', 'pinch', 0.02)], 80, video);
    expect(e.active).toBe(false);
    a.update([hand('Right')], 120, video);
    a.update([hand('Right', 'pinch')], 160, video);
    a.update([hand('Right', 'pinch', 0.02)], 200, video);
    expect(e.active).toBe(true);
  });
  it('preserves handedness through a brief model label flicker', () => {
    const r = new HandIdentityResolver();
    r.resolve([hand('Right', 'open', 0.2), hand('Left', 'open', -0.2)], 0);
    const result = r.resolve([hand('Left', 'open', 0.21), hand('Right', 'open', -0.21)], 40);
    expect(result[0].label).toBe('Right');
    expect(result[1].label).toBe('Left');
  });
  it('a marker alone never draws, keyboard fallback does, and marker loss ends ink', () => {
    const e = new Editor();
    e.configure({ mode: 'pen' });
    const a = new AirController(e);
    a.update([], 0, video, false, p(0.4, 0.4));
    expect(e.active).toBe(false);
    a.keyboardDown = true;
    a.update([], 40, video, false, p(0.41, 0.4));
    a.update([], 80, video, false, p(0.42, 0.4));
    expect(e.active).toBe(true);
    a.update([], 120, video, false, null);
    expect(e.active).toBe(false);
    expect(e.page.strokes).toHaveLength(1);
  });
  it('an open navigation hand overrides the keyboard pen toggle', () => {
    const e = new Editor();
    e.configure({ mode: 'pen' });
    const a = new AirController(e);
    a.keyboardDown = true;
    a.update([hand('Left', 'open')], 0, video, false, p(0.4, 0.4));
    expect(e.active).toBe(false);
  });
});
describe('Camera mapping', () => {
  it('mirrors exactly once and accounts for cover cropping', () => {
    expect(cameraToScreen(p(0.25, 0.5), 1280, 720, 1280, 720, true)).toEqual({ x: 960, y: 360 });
    expect(cameraToScreen(p(0.75, 0.5), 1280, 720, 1280, 720)).toEqual({ x: 960, y: 360 });
    expect(cameraToScreen(p(0.5, 0.5), 1920, 1080, 600, 800)).toEqual({ x: 300, y: 400 });
  });
});
