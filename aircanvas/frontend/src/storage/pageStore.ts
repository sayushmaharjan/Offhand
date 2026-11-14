import {
  defaultSettings,
  type Workspace,
  type Page,
  type Settings,
  type Point,
  type Stroke,
  type Viewport,
  type XY,
} from '../types';
import { screenToWorld, zoomAt, fitBounds } from '../canvas/coordinateTransforms';
import { boundsOf, contentBounds } from '../canvas/strokeEngine';
import { hitStroke } from '../canvas/eraser';
import { OneEuroFilter } from '../canvas/smoothing';
export const newPage = (name = 'Untitled page'): Page => ({
  id: crypto.randomUUID(),
  name,
  strokes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  undo: [],
  redo: [],
  revision: 0,
});
export function newWorkspace(): Workspace {
  const page = newPage('My first canvas');
  return { version: 1, pages: [page], activePageId: page.id, settings: { ...defaultSettings } };
}
export class Editor {
  state: Workspace;
  live: Stroke | null = null;
  size = { width: 1280, height: 720 };
  dirty = true;
  private listeners = new Set<() => void>();
  private revision = 0;
  private filter = new OneEuroFilter();
  private lastRaw: Point | null = null;
  private eraseBefore: Stroke[] | null = null;
  private source: 'mouse' | 'air' = 'mouse';
  constructor(state = newWorkspace()) {
    this.state = state;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.revision;
  get page() {
    return this.state.pages.find((p) => p.id === this.state.activePageId)!;
  }
  get settings() {
    return this.state.settings;
  }
  changed() {
    this.dirty = true;
    this.revision++;
    for (const fn of this.listeners) fn();
  }
  restore(state: Workspace) {
    this.end();
    this.state = state;
    this.changed();
  }
  configure(settings: Partial<Settings>) {
    this.end();
    this.state.settings = { ...this.settings, ...settings };
    this.changed();
  }
  viewport(v: Viewport) {
    this.end();
    this.page.viewport = v;
    this.changed();
  }
  pan(dx: number, dy: number) {
    const v = this.page.viewport;
    this.viewport({ ...v, x: v.x + dx, y: v.y + dy });
  }
  zoom(factor: number, anchor = { x: this.size.width / 2, y: this.size.height / 2 }) {
    this.viewport(zoomAt(this.page.viewport, anchor, factor));
  }
  fit() {
    const b = contentBounds(this.page.strokes);
    this.viewport(b ? fitBounds(b, this.size.width, this.size.height) : { x: 0, y: 0, zoom: 1 });
  }
  private history(before: Stroke[]) {
    this.page.undo = [...this.page.undo.slice(-79), before];
    this.page.redo = [];
    this.page.revision++;
  }
  begin(p: Point, source: 'mouse' | 'air' = 'mouse') {
    this.end();
    this.source = source;
    this.filter.reset();
    this.lastRaw = null;
    if (this.settings.tool === 'hand') return;
    if (this.settings.tool === 'eraser') {
      this.eraseBefore = this.page.strokes;
      this.append(p);
      return;
    }
    const q = screenToWorld(p, this.page.viewport);
    this.live = {
      id: crypto.randomUUID(),
      color: this.settings.color,
      width: this.settings.width,
      opacity: this.settings.tool === 'highlighter' ? 0.3 : 1,
      points: [{ ...q, t: p.t }],
      bounds: boundsOf([{ ...q, t: p.t }], this.settings.width),
    };
    this.lastRaw = p;
    this.filter.next(p, this.settings.smoothing);
    this.dirty = true;
  }
  append(p: Point) {
    if (this.eraseBefore) {
      const q = screenToWorld(p, this.page.viewport);
      const next = this.page.strokes.filter((s) => !hitStroke(s, q, 12 / this.page.viewport.zoom));
      if (next.length !== this.page.strokes.length) {
        this.page.strokes = next;
        this.page.revision++;
        this.dirty = true;
      }
      return;
    }
    if (!this.live) return;
    if (
      this.source === 'air' &&
      this.lastRaw &&
      (p.t - this.lastRaw.t > 180 ||
        Math.hypot(p.x - this.lastRaw.x, p.y - this.lastRaw.y) >
          Math.max(110, Math.min(this.size.width, this.size.height) * 0.2))
    ) {
      this.end();
      return;
    }
    this.lastRaw = p;
    const smooth = this.filter.next(
        p,
        this.source === 'mouse' ? this.settings.smoothing * 0.3 : this.settings.smoothing,
      ),
      q = screenToWorld(smooth, this.page.viewport),
      last = this.live.points.at(-1)!;
    if (
      Math.hypot(q.x - last.x, q.y - last.y) * this.page.viewport.zoom <
      this.settings.minMovement
    )
      return;
    this.live.points.push({ ...q, t: p.t });
    const b = this.live.bounds,
      r = this.live.width / 2;
    b.minX = Math.min(b.minX, q.x - r);
    b.minY = Math.min(b.minY, q.y - r);
    b.maxX = Math.max(b.maxX, q.x + r);
    b.maxY = Math.max(b.maxY, q.y + r);
    this.dirty = true;
  }
  end() {
    if (this.live) {
      if (this.source === 'mouse' || this.live.points.length > 1) {
        this.history(this.page.strokes);
        this.page.strokes = [...this.page.strokes, this.live];
      }
      this.live = null;
      this.changed();
    }
    if (this.eraseBefore) {
      if (this.eraseBefore !== this.page.strokes) {
        this.history(this.eraseBefore);
        this.changed();
      }
      this.eraseBefore = null;
    }
    this.lastRaw = null;
  }
  get active() {
    return this.live !== null || this.eraseBefore !== null;
  }
  undo() {
    this.end();
    const p = this.page,
      prev = p.undo.pop();
    if (prev) {
      p.redo.push(p.strokes);
      p.strokes = prev;
      p.revision++;
      this.changed();
    }
  }
  redo() {
    this.end();
    const p = this.page,
      next = p.redo.pop();
    if (next) {
      p.undo.push(p.strokes);
      p.strokes = next;
      p.revision++;
      this.changed();
    }
  }
  clear() {
    this.end();
    if (this.page.strokes.length) {
      this.history(this.page.strokes);
      this.page.strokes = [];
      this.changed();
    }
  }
  addPage() {
    this.end();
    const p = newPage(`Page ${this.state.pages.length + 1}`);
    this.state.pages.push(p);
    this.state.activePageId = p.id;
    this.changed();
  }
  switchPage(id: string) {
    if (this.state.pages.some((p) => p.id === id)) {
      this.end();
      this.state.activePageId = id;
      this.changed();
    }
  }
  rename(id: string, name: string) {
    const p = this.state.pages.find((p) => p.id === id);
    if (p && name.trim()) {
      p.name = name.trim().slice(0, 100);
      this.changed();
    }
  }
  duplicate(id: string) {
    this.end();
    const original = this.state.pages.find((p) => p.id === id);
    if (!original) return;
    const p = {
      ...newPage(`${original.name} copy`),
      strokes: structuredClone(original.strokes),
      viewport: { ...original.viewport },
    };
    this.state.pages.push(p);
    this.state.activePageId = p.id;
    this.changed();
  }
  deletePage(id: string) {
    this.end();
    this.state.pages = this.state.pages.filter((p) => p.id !== id);
    if (!this.state.pages.length) this.state.pages = [newPage('My first canvas')];
    if (id === this.state.activePageId) this.state.activePageId = this.state.pages[0].id;
    this.changed();
  }
}
