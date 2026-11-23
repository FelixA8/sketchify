import { bounds, createElement, safeTextLink } from '../scene';
import { TextEditor } from '../text-editor';
import { font, layout, markRange, rangeMarks } from '../text';
import type { Element, Mark, Point } from '../types';
import type { Controller } from './controller';
import { snapshot, type State } from './store';
import { ink, selectionHandles } from './canvas';
import { fitBoundText, textContainer } from '../bound-text';
import { layerModel } from './layers';

export function selectedText(s: State) {
  if (s.editing || s.selected.size !== 1 || s.gesture || s.preferences.zenMode || s.dialog) return;
  const element = s.elements.find(element => s.selected.has(element.id));
  if (element?.type !== 'text' || !element.text.length) return;
  const { hidden, locked } = layerModel(s.elements, s.layers);
  if (!hidden.has(element.id) && !locked.has(element.id)) return element;
}

export const wholeTextMarks = (element: Element) => rangeMarks(element.text, element.textSpans, 0, element.text.length);

export class TextSession {
  readonly editor: TextEditor;
  private baselineOffsets = new Map<string, number>();
  constructor(readonly app: Controller) {
    this.editor = new TextEditor(app.get('text-editor'), () => app.run(() => this.sync()), () => app.run(() => this.formatting()), () => app.run(() => this.openLink()));
  }
  dispose() { this.editor.dispose(); }
  refreshFontMetrics() { this.baselineOffsets.clear(); this.resize(); }
  edit(p: Point, existing?: Element) {
    if (existing && this.app.isLocked(existing)) return;
    this.finish(); const a = this.app, s = a.state;
    const parent = existing && (textContainer(existing) ? existing : s.elements.find(element => element.id === existing.containerId));
    if (parent && a.isLocked(parent)) return;
    const label = existing && textContainer(existing) ? s.elements.find(element => element.type === 'text' && element.containerId === existing.id) : existing;
    if (label && a.isLocked(label)) return;
    const element = label ? snapshot(label) : parent ? createElement('text', p.x, p.y, snapshot(s.style)) : a.createDrawingElement('text', p);
    if (!label && parent?.frameId) element.frameId = parent.frameId;
    if (parent?.type === 'stickynote') Object.assign(element, { strokeColor: parent.strokeColor, opacity: parent.opacity, fontSize: parent.fontSize, fontFamily: parent.fontFamily, baseFontSize: parent.fontSize });
    if (parent && textContainer(parent)) Object.assign(element, { containerId: parent.id, textAlign: label?.textAlign ?? parent.textAlign ?? 'center', verticalAlign: label?.verticalAlign ?? parent.verticalAlign ?? 'middle' });
    s.editing = { id: element.id, element, fresh: !label, ...(parent && textContainer(parent) ? { container: snapshot(parent) } : {}) }; s.selected.clear();
    a.get('text-editor').hidden = false; s.linkTarget = null;
    this.editor.load(element); if (innerWidth > 760) s.panel = true;
    this.resize(); a.get('text-editor').focus({ preventScroll: true });
  }
  resize() {
    const a = this.app, s = a.state; if (!s.editing) return;
    const editor = a.get('text-editor'), element = s.editing.element;
    Object.assign(element, this.editor.model);
    if (s.editing.container) {
      const parent = s.elements.find(parent => parent.id === element.containerId)!;
      if (parent.type !== 'stickynote') s.editing.container = snapshot(parent);
      fitBoundText(element, s.editing.container, a.ctx);
      if (parent.type === 'rectangle') Object.assign(s.editing.container, { textAlign: element.textAlign, verticalAlign: element.verticalAlign });
    } else if (element.angle) a.measure(element);
    editor.style.left = `${element.x * s.zoom + s.pan.x}px`; editor.style.top = `${element.y * s.zoom + s.pan.y}px`;
    const editorFont = font({ ...element, fontSize: element.fontSize * s.zoom });
    editor.style.font = editorFont; editor.style.lineHeight = '1.25';
    editor.style.whiteSpace = element.textWidth ? 'pre-wrap' : 'pre'; editor.style.overflowWrap = 'anywhere';
    editor.style.textAlign = element.textAlign ?? 'left';
    const baselineOffset = this.baselineOffset(editor, editorFont);
    editor.style.transformOrigin = `${element.width * s.zoom / 2}px ${element.height * s.zoom / 2}px`;
    editor.style.transform = `${element.angle ? `rotate(${element.angle}rad) ` : ''}translateY(${baselineOffset}px)`;
    editor.style.setProperty('--text-baseline-offset', `${baselineOffset}px`);
    editor.style.color = ink(s, element.strokeColor); editor.style.opacity = String(element.opacity / 100);
    editor.style.setProperty('--text-link', s.theme === 'dark' ? '#74c0fc' : '#1971c2');
    const measured = layout({ ...element, ...this.editor.model }, a.ctx);
    editor.style.setProperty('--text-content-height', `${measured.contentHeight * s.zoom}px`);
    editor.style.width = `${Math.max(1, element.textWidth ? measured.width * s.zoom : Math.ceil(measured.width * s.zoom))}px`;
    editor.style.height = `${Math.ceil(measured.height * s.zoom)}px`; editor.scrollLeft = 0;
    this.formatting();
  }
  private baselineOffset(editor: HTMLElement, canvasFont: string) {
    const key = `${editor.style.font}/${editor.style.lineHeight}`;
    const cached = this.baselineOffsets.get(key); if (cached !== undefined) return cached;
    const probe = document.createElement('div'), marker = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;white-space:pre;padding:0;border:0;margin:0;width:max-content';
    probe.style.font = editor.style.font; probe.style.lineHeight = editor.style.lineHeight;
    marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    probe.append('M', marker); this.app.root.append(probe);
    const baseline = marker.getBoundingClientRect().top - probe.getBoundingClientRect().top;
    probe.remove();
    if (!baseline) return 0;
    // Match the canvas top baseline without moving the saved element or changing line spacing.
    const ctx = this.app.ctx; ctx.save(); ctx.font = canvasFont;
    ctx.textBaseline = 'alphabetic'; const ascent = ctx.measureText('M').actualBoundingBoxAscent;
    ctx.textBaseline = 'top'; const topAscent = ctx.measureText('M').actualBoundingBoxAscent;
    ctx.restore();
    const offset = ascent - topAscent - baseline;
    this.baselineOffsets.set(key, offset); return offset;
  }
  sync() { if (this.app.state.editing) { Object.assign(this.app.state.editing.element, this.editor.model); this.resize(); } }
  formatting() {
    const a = this.app, s = a.state; if (!s.editing) return;
    s.marks = this.editor.activeMarks();
    this.positionFormatting();
  }
  positionFormatting() {
    const a = this.app, s = a.state, element = s.editing?.element ?? selectedText(s);
    if (!element) return;
    const toolbar = a.get('text-formatting'), b = bounds(element);
    const x = b.x * s.zoom + s.pan.x, y = b.y * s.zoom + s.pan.y;
    const height = toolbar.offsetHeight || (s.linkTarget === element.id ? 260 : 54);
    const width = toolbar.offsetWidth || 272;
    const rotationHandle = s.editing ? undefined : selectionHandles(s).find(handle => handle.key === 'rotate');
    const rotationY = rotationHandle ? rotationHandle.y * s.zoom + s.pan.y : y;
    const gap = s.editing ? 8 : 14;
    const above = Math.min(y, rotationY) - height - gap;
    const below = Math.max(y + b.height * s.zoom, rotationY) + gap;
    const mobileToolbarTop = !s.editing && innerWidth <= 760 ? a.get('toolbar').getBoundingClientRect().top : 0;
    const bottom = (mobileToolbarTop || a.height) - 12;
    const top = s.editing ? (above >= 12 ? above : below) : (below + height <= bottom ? below : above);
    toolbar.style.left = `${Math.max(12, Math.min(x, a.width - width - 12))}px`;
    toolbar.style.top = `${Math.max(12, Math.min(top, bottom - height))}px`;
  }
  toggleMark(mark: Exclude<Mark, 'link'>) {
    const s = this.app.state;
    if (s.editing) { this.editor.toggle(mark); return; }
    const element = selectedText(s);
    if (element) this.formatWholeText(element, mark, !wholeTextMarks(element)[mark]);
  }
  private formatWholeText(element: Element, mark: Mark, value: string | boolean) {
    element.textSpans = markRange(element.text, element.textSpans, 0, element.text.length, mark, value);
    this.app.measure(element);
    this.app.commit();
  }
  closeLink() {
    const a = this.app;
    a.state.linkTarget = null;
    if (!a.state.editing) { a.canvas.focus({ preventScroll: true }); return; }
    a.get('text-editor').focus({ preventScroll: true });
    this.editor.select(this.editor.savedSelection.start, this.editor.savedSelection.end); this.formatting();
  }
  openLink() {
    const a = this.app, s = a.state, element = s.editing?.element ?? selectedText(s);
    if (!element) return;
    const marks = s.editing ? this.editor.activeMarks() : wholeTextMarks(element);
    const caret = this.editor.savedSelection;
    if (s.editing && caret.start === caret.end && marks.link) {
      const spans = this.editor.model.textSpans.filter(span => span.link === marks.link);
      const containing = spans.findIndex(span => span.start <= caret.start && span.end >= caret.start);
      if (containing >= 0) {
        let first = containing, last = containing;
        while (first > 0 && spans[first - 1].end === spans[first].start) first--;
        while (last + 1 < spans.length && spans[last].end === spans[last + 1].start) last++;
        this.editor.select(spans[first].start, spans[last].end);
      }
    }
    s.linkURL = marks.link || ''; s.linkError = ''; s.linkTarget = element.id;
    const input = a.get<HTMLInputElement>('text-link-url');
    input.value = s.linkURL;
    input.focus({ preventScroll: true });
    this.formatting();
  }
  applyLink(remove = false) {
    const a = this.app, s = a.state, element = s.editing?.element ?? selectedText(s);
    if (!element || s.linkTarget !== element.id) return;
    const link = remove ? '' : safeTextLink(a.get<HTMLInputElement>('text-link-url').value);
    if (!remove && !link) { s.linkError = 'Enter a valid web or email link.'; a.get('text-link-url').focus(); return; }
    if (!s.editing) this.formatWholeText(element, 'link', link);
    else if (link && this.editor.savedSelection.start === this.editor.savedSelection.end) this.editor.insert(link, { ...this.editor.activeMarks(), link });
    else this.editor.apply('link', link);
    this.closeLink();
  }
  finish(cancel = false) {
    const a = this.app, s = a.state, editing = s.editing; if (!editing) return;
    // Materialize before removing the draft; editor callbacks may update the store again.
    const element = snapshot(editing.element), id = editing.id, fresh = editing.fresh, container = editing.container && snapshot(editing.container);
    s.editing = null; s.linkTarget = null;
    a.get('text-editor').hidden = true; if (!s.locked) s.tool = 'selection';
    if (!cancel) {
      Object.assign(element, this.editor.model);
      if (element.text.trim()) {
        if (container) {
          fitBoundText(element, container, a.ctx);
          const parent = s.elements.find(parent => parent.id === container.id)!;
          Object.assign(parent, container);
          parent.boundElements = [...(Array.isArray(parent.boundElements) ? parent.boundElements.filter(bound => bound.id !== id) : []), { id, type: 'text' }];
        } else a.measure(element);
        if (fresh) s.elements.push(element); else Object.assign(s.elements.find(e => e.id === id)!, element);
        a.objects.select(container?.id ?? id);
      } else {
        s.elements = s.elements.filter(e => e.id !== id);
        const parent = s.elements.find(parent => parent.id === element.containerId);
        if (parent && Array.isArray(parent.boundElements)) parent.boundElements = parent.boundElements.filter(bound => bound.id !== id);
        if (parent) {
          if (container?.type === 'stickynote') Object.assign(parent, container);
          a.objects.select(parent.id);
        }
      }
      a.commit();
    } else if (container || !fresh) a.objects.select(container?.id ?? id);
  }
  mount() {
    const a = this.app;
    a.listen(a.get('text-editor'), 'blur', event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('#properties, #text-formatting')) this.finish(); });
    a.listen(a.get('text-editor'), 'keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.stopPropagation(); this.finish(true); a.canvas.focus(); }
      else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.finish(); a.canvas.focus(); }
    });
    a.listen(a.get('text-formatting'), 'pointerdown', event => {
      if (a.state.editing && (event.target as HTMLElement).closest('button')) { event.preventDefault(); this.editor.captureSelection(); }
    });
    a.listen(a.get('text-formatting'), 'keydown', event => {
      if (!a.state.editing) return;
      event.stopPropagation(); if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); this.finish(true); a.canvas.focus(); }
      else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.finish(); a.canvas.focus(); }
    });
    a.listen(a.get('text-link-form'), 'keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); this.closeLink(); } });
    a.listen(document, 'pointerdown', event => {
      if (!a.state.editing && !(event.target as HTMLElement).closest('#text-formatting')) a.state.linkTarget = null;
    });
    a.listen(window, 'resize', () => this.positionFormatting());
    a.listen(a.get('properties'), 'pointerdown', event => { if (a.state.editing && (event.target as HTMLElement).closest('button')) event.preventDefault(); });
    a.listen(a.get('style-toggle'), 'pointerdown', event => { if (a.state.editing) event.preventDefault(); });
  }
}
