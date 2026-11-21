import { createElement, sceneBounds } from '../scene';
import type { Element, Point, Style, Tool } from '../types';
import { selectedElements, screenToWorld, measureText } from './canvas';
import { createPersistence, loadStorage } from './persistence';
import { snapshot, type Store, type State, type Preference } from './store';
import { TextSession } from './text-session';
import { FileActions } from './files';
import { mountGestures } from './gestures';
import { mountKeyboard } from './keyboard';
import { copyElements, ObjectActions, selectionWithChildren } from './object-actions';
import { ImageActions } from './image-actions';
import { fitBoundLabels, textContainer } from '../bound-text';
import { bindEndpoint, bindingKeys, connectorPoints, isConnector, syncConnectors } from '../connectors';
import { HANDWRITING_FONT, EXCALIFONT } from '../fonts';
import { selectionGroup } from './groups';
import { WorkspaceActions } from './workspace-actions';
import { layerModel, visibleElements } from './layers';
import { NOTE_MIN_SIZE, NOTE_SIZE } from '../notes';
export class Controller {
  readonly text: TextSession;
  readonly files: FileActions;
  readonly objects: ObjectActions;
  readonly images: ImageActions;
  readonly workspace: WorkspaceActions;
  readonly persistence: ReturnType<typeof createPersistence>;
  readonly abort = new AbortController();
  private toastTimer?: ReturnType<typeof setTimeout>;
  private returnFocus: HTMLElement | null = null;
  private fontRefreshPending = false;
  constructor(readonly store: Store, readonly root: HTMLElement) {
    this.persistence = createPersistence(store, (message, error) => this.toast(message, error));
    this.text = new TextSession(this); this.files = new FileActions(this); this.objects = new ObjectActions(this);
    this.images = new ImageActions(this);
    this.workspace = new WorkspaceActions(this);
  }
  get state() { return this.store.state; }
  get canvas() { return this.get<HTMLCanvasElement>('canvas'); }
  get ctx() { return this.canvas.getContext('2d')!; }
  get width() { return this.canvas.clientWidth; }
  get height() { return this.canvas.clientHeight; }
  get<T extends HTMLElement = HTMLElement>(id: string) { return this.root.querySelector<T>(`#${id}`)!; }
  run(fn: () => void) { this.store.change(fn); }
  listen<K extends keyof WindowEventMap>(target: EventTarget, type: K, fn: (event: WindowEventMap[K]) => void, options: AddEventListenerOptions = {}) {
    target.addEventListener(type, (event => this.run(() => fn(event as WindowEventMap[K]))) as EventListener, { ...options, signal: this.abort.signal });
  }
  mount() {
    this.store.change(s => { s.panel = innerWidth > 760; });
    let error = '';
    try { error = loadStorage(this.store, localStorage); }
    catch { error = 'Saved data could not be read. You can open an exported .excalidraw file from the menu.'; }
    this.run(() => { for (const element of this.state.elements) if (element.type === 'text') this.measure(element); this.syncGeometry(); });
    this.store.resetHistory();
    mountGestures(this); mountKeyboard(this); this.text.mount(); this.files.mount();
    this.listen(this.get('properties'), 'input', event => {
      const input = event.target as HTMLInputElement;
      if (input.id === 'opacity') this.applyStyle('opacity', Number(input.value), false);
      if (input.id === 'corner-rounding') this.applyStyle('roundness', { type: 3, value: Number(input.value) }, false);
    });
    this.listen(this.get('properties'), 'change', event => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.color) this.applyStyle(input.dataset.color as 'strokeColor' | 'backgroundColor', input.value);
      if (input.id === 'opacity') this.applyStyle('opacity', Number(input.value));
      if (input.id === 'corner-rounding') this.applyStyle('roundness', { type: 3, value: Number(input.value) });
    });
    this.listen(window, 'blur', () => { this.state.space = false; this.finishGesture(); this.state.contextMenu = null; });
    this.listen(window, 'resize', () => { this.state.contextMenu = null; });
    this.listen(window, 'hashchange', () => this.objects.followObjectLink());
    this.run(() => this.objects.followObjectLink());
    this.listen(window, 'beforeunload', () => { this.text.finish(); this.finishFrameName(); this.persistence.persist(); });
    this.listen(document, 'pointerdown', event => {
      const target = event.target as HTMLElement;
      if (!target.closest('#canvas, #text-editor, #properties, #text-formatting')) this.text.finish();
      if (!target.closest('#menu, #menu-button')) this.state.menu = false;
      if (!target.closest('#object-context-menu')) this.state.contextMenu = null;
    });
    if (error) this.toast(error, true); else this.persistence.schedule();
    for (const family of [HANDWRITING_FONT, EXCALIFONT]) if (document.fonts && !document.fonts.check(`32px ${family}`, 'Aa Ą Я Ω ∑ Ѣ \u0301')) {
      void document.fonts.load(`32px ${family}`, 'Aa Ą Я Ω ∑ Ѣ \u0301').then(fonts => {
        if (this.abort.signal.aborted || !fonts.length) return;
        this.run(() => { this.fontRefreshPending = true; this.refreshFonts(); });
      }).catch(() => {});
    }
    this.store.change(s => { s.restored = true; });
  }
  dispose() { this.abort.abort(); this.text.dispose(); this.persistence.dispose(); clearTimeout(this.toastTimer); this.files.dispose(); }
  toast(message: string, error = false) {
    this.store.change(s => { s.toast = { message, error }; }); clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.store.change(s => { s.toast = null; }), error ? 7000 : 3500);
  }
  syncGeometry() { fitBoundLabels(this.state.elements, this.ctx); syncConnectors(this.state.elements); }
  private remeasureScene() {
    for (const element of this.state.elements) if (element.type === 'text') this.measure(element);
    this.syncGeometry();
  }
  private refreshFonts() {
    if (!this.fontRefreshPending || this.state.gesture) return;
    this.fontRefreshPending = false;
    this.remeasureScene(); this.text.refreshFontMetrics(); this.persistence.schedule();
  }
  commit() { this.syncGeometry(); this.store.commit(); this.persistence.schedule(); }
  rebindConnectors(originals: Element[]) {
    const ids = new Set(originals.map(element => element.id));
    for (const original of originals) {
      if (!isConnector(original)) continue;
      const element = this.state.elements.find(element => element.id === original.id)!;
      const points = connectorPoints(element);
      if (points.length < 2) continue;
      for (const key of bindingKeys) {
        const binding = original[key];
        if (binding === undefined) delete element[key]; else element[key] = snapshot(binding);
        if (!binding || !ids.has(binding.elementId)) {
          if (this.state.preferences.arrowBinding) bindEndpoint(element, key, points[key === 'startBinding' ? 0 : points.length - 1], this.interactive(), this.state.zoom);
          else if (binding) element[key] = null;
        }
      }
    }
  }
  selected() { return selectedElements(this.state); }
  visible() { return visibleElements(this.state.elements, this.state.layers); }
  isLocked(element: Element) { return layerModel(this.state.elements, this.state.layers).locked.has(element.id); }
  interactive() { return this.visible().filter(element => !this.isLocked(element)); }
  world(x: number, y: number) { return screenToWorld(this.state, x, y); }
  point(event: MouseEvent) { const rect = this.canvas.getBoundingClientRect(); return this.world(event.clientX - rect.left, event.clientY - rect.top); }
  snap(p: Point) { return this.state.grid ? { x: Math.round(p.x / 20) * 20, y: Math.round(p.y / 20) * 20 } : p; }
  measure(element: Element) { measureText(element, this.ctx); }
  editFrameName(id: string) {
    const frame = this.state.elements.find(element => element.id === id && element.type === 'frame');
    if (!frame || this.isLocked(frame)) return;
    this.text.finish(); this.finishFrameName();
    this.objects.select(id); this.state.frameEditing = id;
    this.state.menu = false; this.state.contextMenu = null;
  }
  finishFrameName(cancel = false) {
    const id = this.state.frameEditing;
    if (!id) return;
    const name = this.get<HTMLInputElement>('frame-name')?.value.trim() || 'Frame';
    this.state.frameEditing = null;
    const frame = this.state.elements.find(element => element.id === id && element.type === 'frame');
    if (!cancel && frame && !this.isLocked(frame) && name !== (frame.name || 'Frame')) { frame.name = name; this.commit(); }
  }
  setTool(tool: Tool) {
    this.text.finish(); const s = this.state; s.tool = tool; s.cursor = null; s.connectorHint = null;
    s.contextMenu = null;
    if (tool !== 'selection') { s.selected.clear(); s.editingGroup = null; }
    if (['hand', 'eraser'].includes(tool)) s.panel = false;
    else if (tool !== 'selection' && innerWidth > 760) s.panel = true;
    s.menu = false;
  }
  applyStyle<K extends keyof Style>(property: K, value: Style[K], final = true) {
    const s = this.state, targets = this.objects.editable();
    const note = s.editing?.container?.type === 'stickynote' || s.tool === 'stickynote' || targets.length > 0 && targets.every(element => element.type === 'stickynote' || element.type === 'text' && s.elements.some(parent => parent.id === element.containerId && parent.type === 'stickynote'));
    if (note && property === 'backgroundColor' && value === 'transparent') return;
    (note ? s.noteStyle : s.style)[property] = value;
    if (s.editing) {
      if (note && s.editing.container) Object.assign(s.editing.container, { [property]: snapshot(value) });
      if (!note || property !== 'backgroundColor') Object.assign(s.editing.element, { [property]: value }, note && property === 'fontSize' ? { baseFontSize: value } : {});
      this.text.resize();
      if (final) this.get('text-editor').focus({ preventScroll: true });
      return;
    }
    for (const element of targets) {
      if (property === 'roundness' && element.type !== 'rectangle') continue;
      if (note && property === 'backgroundColor' && element.type === 'text') continue;
      Object.assign(element, { [property]: snapshot(value) }); if (element.type === 'text') this.measure(element);
    }
    if (final) this.commit(); else this.syncGeometry();
  }
  duplicate() {
    const copies = this.objects.copies({ x: 20, y: 20 });
    this.state.elements.push(...copies); this.state.selected = new Set(copies.map(e => e.id)); this.commit();
  }
  setTextAlignment<K extends 'textAlign' | 'verticalAlign'>(property: K, value: NonNullable<Element[K]>) {
    const s = this.state;
    if (s.editing) {
      const element = s.editing.element;
      if (element.containerId && !['rectangle', 'stickynote'].includes(s.editing.container?.type ?? '') || property === 'verticalAlign' && !element.containerId) return;
      element[property] = value;
      if (s.editing.container?.type === 'stickynote') s.editing.container[property] = value;
      if (!element.containerId && property === 'textAlign') s.style.textAlign = value as Element['textAlign'];
      this.text.resize(); this.get('text-editor').focus({ preventScroll: true }); return;
    }
    if (!s.selected.size && s.tool === 'text' && property === 'textAlign') s.style.textAlign = value as Element['textAlign'];
    for (const selected of this.selected()) {
      const parent = ['rectangle', 'stickynote'].includes(selected.type) ? selected : s.elements.find(element => element.id === selected.containerId);
      const text = selected.type === 'text' ? selected : s.elements.find(element => element.type === 'text' && element.containerId === selected.id);
      if (this.isLocked(selected) || parent && this.isLocked(parent) || text && this.isLocked(text)) continue;
      if (parent && ['rectangle', 'stickynote'].includes(parent.type)) {
        parent[property] = value;
        if (text) text[property] = value;
      } else if (selected.type === 'text' && !selected.containerId && property === 'textAlign') {
        selected.textAlign = value as Element['textAlign']; s.style.textAlign = selected.textAlign; this.measure(selected);
      }
    }
    this.commit();
  }
  setTextWidth(width?: number) {
    const s = this.state, text = s.editing ? [s.editing.element] : this.objects.editable().filter(element => element.type === 'text');
    for (const element of text) {
      if (width && Number.isFinite(width)) element.textWidth = Math.max(8, Math.min(10000, width));
      else delete element.textWidth;
      this.measure(element);
    }
    if (s.editing) this.text.resize(); else this.commit();
  }
  removeElements(ids: Set<string>, final = true) {
    const unlocked = new Set(this.state.elements.filter(element => ids.has(element.id) && !this.isLocked(element)).map(element => element.id));
    const removed = new Set(selectionWithChildren(this.state.elements, unlocked).filter(element => !this.isLocked(element)).map(element => element.id));
    this.state.elements = this.state.elements.filter(element => !removed.has(element.id));
    for (const element of this.state.elements) {
      if (element.frameId && removed.has(element.frameId)) element.frameId = null;
      if (element.containerId && removed.has(element.containerId)) element.containerId = null;
      if (Array.isArray(element.boundElements)) element.boundElements = element.boundElements.filter(bound => !removed.has(bound.id));
    }
    this.state.selected.clear();
    if (this.state.editingGroup && !this.state.elements.some(element => element.groupIds.includes(this.state.editingGroup!))) this.state.editingGroup = null;
    if (final) this.commit();
  }
  removeSelected() { this.removeElements(new Set(this.objects.editable().map(element => element.id))); }
  history(direction: 'undo' | 'redo') { this.text.finish(); this.state.contextMenu = null; this.store.travel(direction); this.remeasureScene(); this.persistence.schedule(); }
  theme(theme: State['theme']) { this.state.theme = theme; this.persistence.schedule(); }
  togglePreference(key: Preference | 'grid') {
    this.state.connectorHint = null;
    if (key === 'grid') this.state.grid = !this.state.grid;
    else this.state.preferences[key] = !this.state.preferences[key];
    if ((key === 'canvasProperties' || key === 'minimap') && this.state.preferences[key] && innerWidth <= 760) this.state.panel = false;
    if (key === 'zenMode') {
      this.state.menu = false;
      this.state.contextMenu = null;
      this.canvas.focus({ preventScroll: true });
    }
    this.persistence.schedule();
  }
  zoom(next: number, anchor = { x: this.width / 2, y: this.height / 2 }) {
    this.text.finish(); const p = this.world(anchor.x, anchor.y), s = this.state;
    s.zoom = Math.max(.1, Math.min(5, next)); s.pan = { x: anchor.x - p.x * s.zoom, y: anchor.y - p.y * s.zoom }; this.persistence.schedule();
  }
  fit() {
    this.text.finish(); const s = this.state;
    const visible = this.visible();
    if (!visible.length) { s.pan = { x: 0, y: 0 }; s.zoom = 1; return; }
    const b = sceneBounds(visible), left = innerWidth > 760 && s.sidebar ? 184 : 60, right = innerWidth > 760 && !this.get('properties').hidden ? 240 : 60;
    s.zoom = Math.max(.1, Math.min(1.5, (this.width - left - right) / Math.max(b.width, 1), (this.height - 240) / Math.max(b.height, 1)));
    s.pan = { x: left + (this.width - left - right - b.width * s.zoom) / 2 - b.x * s.zoom, y: (this.height - b.height * s.zoom) / 2 - b.y * s.zoom - (innerWidth <= 760 ? 30 : 0) };
    this.persistence.schedule();
  }
  openDialog(kind: NonNullable<State['dialog']>) {
    const active = document.activeElement as HTMLElement;
    this.returnFocus = active.closest('#menu') ? this.get('menu-button') : active;
    this.text.finish(); this.state.menu = false; this.state.dialog = kind;
  }
  closeDialog() {
    this.state.dialog = null;
    const dialog = this.get<HTMLDialogElement>('dialog');
    if (dialog.open) dialog.close();
    this.returnFocus?.focus();
  }
  action(action: string) {
    switch (action) {
      case 'open': this.get<HTMLInputElement>('open-file').click(); break;
      case 'save': this.files.save(); break;
      case 'export': if (!this.state.elements.length) this.toast('Draw something before exporting an image.'); else this.openDialog('export'); break;
      case 'rename': case 'help': this.openDialog(action); break;
      case 'preferences': this.state.menuPage = 'preferences'; this.state.menu = true; return;
      case 'clear': if (!this.state.elements.length) this.toast('The canvas is already empty.'); else this.openDialog('clear'); break;
      case 'grid': this.togglePreference('grid'); break;
      case 'light': case 'dark': this.theme(action); break;
      case 'duplicate': this.duplicate(); break;
      case 'delete': this.removeSelected(); break;
      case 'back': case 'front': this.objects.layer(action); break;
    }
    if (!['light', 'dark', 'grid'].includes(action)) this.state.menu = false;
  }
  insert(elements: Element[], point?: Point) {
    if (!elements.length) return;
    const b = sceneBounds(elements), center = this.world(this.width / 2, this.height / 2);
    const copies = copyElements(elements, point ? { x: point.x - b.x, y: point.y - b.y } : { x: center.x - b.x - b.width / 2, y: center.y - b.y - b.height / 2 });
    this.state.elements.push(...copies); this.state.selected = new Set(copies.map(e => e.id)); this.state.tool = 'selection'; this.state.editingGroup = null;
    if (innerWidth > 760) this.state.panel = true; this.commit();
  }
  finishGesture(cancel = false) {
    const s = this.state, gesture = s.gesture; s.connectorHint = null; if (!gesture) return; s.gesture = null; s.cursor = null;
    if (cancel) {
      if (gesture.kind === 'draw') s.elements = s.elements.filter(e => e.id !== gesture.id);
      else if (gesture.kind === 'erase') s.elements = snapshot(gesture.snapshot);
      else if ('originals' in gesture) for (const original of [...gesture.originals, ...('followers' in gesture ? gesture.followers : [])]) {
        const element = s.elements.find(e => e.id === original.id)!;
        Object.assign(element, snapshot(original));
        for (const key of bindingKeys) if (original[key] === undefined) delete element[key];
      }
    } else if (gesture.kind === 'draw') {
      const element = s.elements.find(e => e.id === gesture.id)!;
      const b = sceneBounds([element]);
      if (element.type === 'stickynote') {
        const click = b.width < 5 && b.height < 5;
        Object.assign(element, b, { width: click ? NOTE_SIZE : Math.max(NOTE_MIN_SIZE, b.width), height: click ? NOTE_SIZE : Math.max(NOTE_MIN_SIZE, b.height) });
        element.baseHeight = element.height;
        this.text.edit({ x: element.x, y: element.y }, element); this.commit(); return;
      }
      if (b.width < 2 && b.height < 2) s.elements = s.elements.filter(e => e.id !== gesture.id);
      else {
        if (['rectangle', 'ellipse', 'diamond'].includes(element.type)) Object.assign(element, b);
        if (!s.locked) { s.tool = 'selection'; s.selected = new Set([element.id]); }
      }
    }
    if (cancel) this.syncGeometry();
    this.refreshFonts();
    if (!cancel && !['pan', 'marquee'].includes(gesture.kind)) this.commit(); else this.persistence.schedule();
  }
  keyboardInsert() {
    const s = this.state, p = this.world(this.width / 2, this.height / 2), selected = this.selected();
    const group = selected[0] && selectionGroup(selected[0], s.editingGroup);
    if (s.tool === 'text') this.text.edit(p);
    else if (s.tool === 'stickynote') {
      const note = createElement('stickynote', p.x - NOTE_SIZE / 2, p.y - NOTE_SIZE / 2, snapshot(s.noteStyle));
      s.elements.push(note); this.text.edit(p, note); this.commit();
    }
    else if (!['selection', 'hand', 'eraser'].includes(s.tool)) {
      const element = { ...createElement(s.tool, p.x - 80, p.y - 50, snapshot(s.style)), width: 160, height: 100 };
      if (['line', 'arrow', 'freedraw'].includes(s.tool)) element.points = [[0, 0], [160, 100]];
      s.elements.push(element); s.selected = new Set([element.id]); if (!s.locked) s.tool = 'selection'; this.commit();
    } else if (group && selected.every(element => selectionGroup(element, s.editingGroup) === group)) this.objects.enterGroup(selected[0].id);
    else if (s.selected.size === 1 && this.selected()[0].type === 'frame') this.editFrameName(this.selected()[0].id);
    else if (s.selected.size === 1 && (this.selected()[0].type === 'text' || textContainer(this.selected()[0]))) this.text.edit(p, this.selected()[0]);
  }
}
