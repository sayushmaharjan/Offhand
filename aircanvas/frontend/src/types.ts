export type XY = { x: number; y: number };
export type Point = XY & { t: number };
export type Viewport = { x: number; y: number; zoom: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Stroke = {
  id: string;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  bounds: Bounds;
};
export type Page = {
  id: string;
  name: string;
  strokes: Stroke[];
  viewport: Viewport;
  undo: Stroke[][];
  redo: Stroke[][];
  revision: number;
};
export type Tool = 'pen' | 'eraser' | 'hand' | 'highlighter';
export type InputMode = 'mouse' | 'finger' | 'pen';
export type Settings = {
  color: string;
  width: number;
  tool: Tool;
  mode: InputMode;
  overlay: boolean;
  overlayOpacity: number;
  preview: boolean;
  feedback: boolean;
  grid: boolean;
  smoothing: number;
  minMovement: number;
  confidence: number;
  pinch: number;
  sensitivity: number;
  grabSensitivity: number;
  writingHand: 'Right' | 'Left';
  invertHands: boolean;
  activation: 'pinch' | 'point';
  markerHue: number;
  markerTolerance: number;
  calibrated: boolean;
};
export type Workspace = { version: 1; pages: Page[]; activePageId: string; settings: Settings };
export type Hand = {
  label: 'Left' | 'Right';
  confidence: number;
  points: { x: number; y: number; z: number }[];
};
export type Gesture = {
  pinch: boolean;
  open: boolean;
  fist: boolean;
  pointing: boolean;
  center: XY;
  tip: XY;
};
export type Feedback = {
  writing: boolean;
  navigation: boolean;
  drawing: boolean;
  pan: string;
  warning: string;
  pointer: XY | null;
  trail: XY[];
};
export const defaultSettings: Settings = {
  color: '#20252b',
  width: 4,
  tool: 'pen',
  mode: 'mouse',
  overlay: false,
  overlayOpacity: 0.35,
  preview: true,
  feedback: true,
  grid: true,
  smoothing: 0.45,
  minMovement: 0.8,
  confidence: 0.55,
  pinch: 0.28,
  sensitivity: 1,
  grabSensitivity: 1,
  writingHand: 'Right',
  invertHands: false,
  activation: 'pinch',
  markerHue: 65,
  markerTolerance: 15,
  calibrated: false,
};
