import { defaultSettings, type Workspace, type Stroke, type Page } from '../types';
import { boundsOf } from '../canvas/strokeEngine';
let database: Promise<IDBDatabase> | undefined;
function openDB() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local storage is unavailable. Export a project to keep your work.'));
      return;
    }
    const r = indexedDB.open('aircanvas', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('workspace');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function loadWorkspace(): Promise<Workspace | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction('workspace').objectStore('workspace').get('current');
    r.onsuccess = () => {
      try {
        resolve(r.result ? validateWorkspace(r.result) : null);
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
  });
}
export async function saveWorkspace(state: Workspace) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    tx.objectStore('workspace').put(state, 'current');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
// Reject malformed imports before changing the live document; recompute untrusted bounds.
export function validateWorkspace(input: unknown): Workspace {
  const value = input as Workspace;
  let points = 0;
  const finite = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e9;
  const strokes = (items: Stroke[]): Stroke[] => {
    if (!Array.isArray(items) || items.length > 50000) throw new Error('Invalid stroke data.');
    return items.map((s) => {
      if (
        !s ||
        typeof s.id !== 'string' ||
        !/^#[0-9a-f]{6}$/i.test(s.color) ||
        !finite(s.width) ||
        s.width < 1 ||
        s.width > 30 ||
        !Array.isArray(s.points) ||
        s.points.length === 0
      )
        throw new Error('Invalid stroke.');
      points += s.points.length;
      if (points > 2000000) throw new Error('Project is too large.');
      for (const p of s.points)
        if (!finite(p.x) || !finite(p.y) || !finite(p.t))
          throw new Error('Invalid stroke coordinates.');
      return {
        ...s,
        opacity: finite(s.opacity) ? Math.max(0.05, Math.min(1, s.opacity)) : 1,
        bounds: boundsOf(s.points, s.width),
      };
    });
  };
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.pages) ||
    value.pages.length < 1 ||
    value.pages.length > 200
  )
    throw new Error('Choose an AirCanvas v1 project JSON file.');
  const ids = new Set<string>();
  const pages: Page[] = value.pages.map((p) => {
    if (
      typeof p.id !== 'string' ||
      ids.has(p.id) ||
      typeof p.name !== 'string' ||
      !p.viewport ||
      !finite(p.viewport.x) ||
      !finite(p.viewport.y) ||
      !finite(p.viewport.zoom) ||
      p.viewport.zoom < 0.1 ||
      p.viewport.zoom > 8
    )
      throw new Error('Invalid page data.');
    ids.add(p.id);
    return {
      ...p,
      name: p.name.slice(0, 100),
      strokes: strokes(p.strokes),
      undo: [],
      redo: [],
      revision: 0,
    };
  });
  const settings = { ...defaultSettings };
  const raw = value.settings ?? {};
  for (const key of Object.keys(settings) as (keyof typeof settings)[]) {
    if (typeof raw[key] === typeof settings[key])
      (settings as unknown as Record<string, unknown>)[key] = raw[key];
  }
  for (const [key, min, max] of [
    ['width', 1, 30],
    ['smoothing', 0, 1],
    ['minMovement', 0, 5],
    ['confidence', 0.3, 0.95],
    ['pinch', 0.12, 0.6],
    ['sensitivity', 0.5, 2],
    ['grabSensitivity', 0.5, 2],
    ['overlayOpacity', 0, 1],
    ['markerHue', 0, 179],
    ['markerTolerance', 3, 45],
  ] as const) {
    const n = settings[key];
    settings[key] = finite(n) ? Math.max(min, Math.min(max, n)) : defaultSettings[key];
  }
  if (!/^#[0-9a-f]{6}$/i.test(settings.color)) settings.color = defaultSettings.color;
  if (!['pen', 'eraser', 'hand', 'highlighter'].includes(settings.tool)) settings.tool = 'pen';
  if (!['mouse', 'finger', 'pen'].includes(settings.mode)) settings.mode = 'mouse';
  if (!['Left', 'Right'].includes(settings.writingHand)) settings.writingHand = 'Right';
  if (!['point', 'pinch'].includes(settings.activation)) settings.activation = 'pinch';
  return {
    version: 1,
    pages,
    settings,
    activePageId: ids.has(value.activePageId) ? value.activePageId : pages[0].id,
  };
}
export function portableWorkspace(state: Workspace) {
  return { ...state, pages: state.pages.map((p) => ({ ...p, undo: [], redo: [] })) };
}
