import { enableMapSet, produce, current, isDraft, type Draft } from 'immer';
import { DEFAULT_STYLE, History } from '../scene';
import type { ArrowType, Box, Element, Marks, Point, Style, Tool } from '../types';
import { defaultProjectName } from './project-name';
import { blankPage, type CanvasPage, type Layers, type PageScene } from './project';
import type { FlowchartPreview } from './flowchart';
import { NOTE_BACKGROUND, NOTE_INK } from '../notes';
enableMapSet();
export const DEFAULT_PREFERENCES = { minimap: false, canvasProperties: false, arrowBinding: true, toolbarHints: true, zenMode: false };
export const DEFAULT_NOTE_STYLE: Style = { ...DEFAULT_STYLE, backgroundColor: NOTE_BACKGROUND, strokeColor: NOTE_INK, fillStyle: 'solid', roughness: 0, textAlign: 'center' };
export type Preference = keyof typeof DEFAULT_PREFERENCES;
export type IconTextSize = 'small' | 'medium' | 'large';
export type Gesture =
  | { kind: 'pan'; start: Point; pan: Point }
  | { kind: 'draw'; start: Point; id: string }
  | { kind: 'endpoint'; end: 'startBinding' | 'endBinding'; originals: Element[] }
  | { kind: 'bend'; start: Point; anchor: Point; index: number; original: Element }
  | { kind: 'move'; start: Point; originals: Element[]; followers: Element[] }
  | { kind: 'resize'; start: Point; sideAnchor?: Point; handle: string; box: Box; angle: number; originals: Element[]; followers: Element[] }
  | { kind: 'rotate'; center: Point; startAngle: number; initialAngle: number; delta: number; box: Box; originals: Element[]; followers: Element[] }
  | { kind: 'marquee'; start: Point; current: Point; initial: Set<string> }
  | { kind: 'erase'; snapshot: Element[] };
export interface State {
  restored: boolean;
  pages: CanvasPage[]; activePageId: string; layers: Layers; sidebar: boolean; sidebarWidth: number | null;
  deletingPage: string | null;
  elements: Element[]; selected: Set<string>; tool: Tool; locked: boolean; style: Style; noteStyle: Style;
  arrowType: ArrowType;
  pan: Point; zoom: number; background: string; theme: 'light' | 'dark'; grid: boolean;
  preferences: typeof DEFAULT_PREFERENCES; menuPage: 'main' | 'preferences'; iconTextSize: IconTextSize;
  panel: boolean; gesture: Gesture | null; space: boolean; clipboard: Element[]; name: string;
  editing: { id: string; element: Element; fresh: boolean; container?: Element } | null;
  frameEditing: string | null;
  editingGroup: string | null;
  connectorHint: Point | null;
  flowchart: FlowchartPreview | null;
  menu: boolean; dialog: 'help' | 'rename' | 'clear' | 'export' | 'import' | 'object-link' | 'delete-page' | null;
  contextMenu: { x: number; y: number; point: Point } | null; styleClipboard: Style | null;
  objectLink: { ids: string[]; value: string; error: string } | null;
  saveState: string; toast: { message: string; error: boolean } | null;
  marks: Marks; linkTarget: string | null; linkURL: string; linkError: string;
  canUndo: boolean; canRedo: boolean; cursor: string | null;
  importInfo: { skipped: number; count: number };
}
export function initialState(width = 1440): State {
  return {
    restored: false,
    pages: [blankPage('Page 1', 'page-1')], activePageId: 'page-1', layers: {}, sidebar: false, sidebarWidth: null, deletingPage: null,
    elements: [], selected: new Set(), tool: 'selection', locked: false, style: { ...DEFAULT_STYLE },
    arrowType: 'straight',
    noteStyle: { ...DEFAULT_NOTE_STYLE },
    pan: { x: 0, y: 0 }, zoom: 1, background: '#ffffff', theme: 'light', grid: false,
    preferences: { ...DEFAULT_PREFERENCES }, menuPage: 'main', iconTextSize: 'medium',
    panel: width > 760, gesture: null, space: false, clipboard: [], name: defaultProjectName(), editing: null, frameEditing: null, editingGroup: null, connectorHint: null,
    flowchart: null, menu: false, dialog: null, saveState: 'Saved on this device', toast: null,
    contextMenu: null, styleClipboard: null, objectLink: null,
    marks: {}, linkTarget: null, linkURL: '', linkError: '', canUndo: false, canRedo: false, cursor: null, importInfo: { skipped: 0, count: 0 },
  };
}
export function snapshot<T>(value: T): T {
  if (isDraft(value)) return structuredClone(current(value));
  // Filtered selections are ordinary arrays whose members can still be drafts.
  if (Array.isArray(value)) return value.map(item => snapshot(item)) as T;
  return structuredClone(value);
}
export function createStore(initial = initialState()) {
  let state = initial, draft: Draft<State> | null = null;
  const listeners = new Set<() => void>();
  const histories = new Map<string, History<PageScene>>();
  const scene = (): PageScene => ({ elements: snapshot((draft || state).elements), layers: snapshot((draft || state).layers) });
  const history = () => {
    const id = (draft || state).activePageId;
    if (!histories.has(id)) histories.set(id, new History(scene()));
    return histories.get(id)!;
  };
  history();
  return {
    get state(): State { return draft || state; },
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    change(recipe: (state: State) => void) {
      if (draft) { recipe(draft); return; }
      const next = produce(state, value => {
        draft = value;
        try { recipe(value); } finally { draft = null; }
      });
      if (next !== state) { state = next; listeners.forEach(listener => listener()); }
    },
    commit() {
      const h = history(); h.commit(scene());
      this.change(s => { s.canUndo = h.canUndo; s.canRedo = h.canRedo; });
    },
    resetHistory(all = false) {
      if (all) histories.clear();
      histories.set(this.state.activePageId, new History(scene()));
      this.change(s => { s.canUndo = false; s.canRedo = false; });
    },
    pageHistory() {
      const h = history();
      for (const id of histories.keys()) if (!this.state.pages.some(page => page.id === id)) histories.delete(id);
      this.change(s => { s.canUndo = h.canUndo; s.canRedo = h.canRedo; });
    },
    travel(direction: 'undo' | 'redo') {
      const h = history();
      this.change(s => { Object.assign(s, h[direction]()); s.selected.clear(); s.editingGroup = null; s.canUndo = h.canUndo; s.canRedo = h.canRedo; });
    },
  };
}
export type Store = ReturnType<typeof createStore>;
