import { bounds, createElement, DEFAULT_STYLE, importScene, safeTextLink, sceneBounds, uid, unrotatedBounds, pointInElementBounds } from '../scene';
import type { Element, Point, Style } from '../types';
import type { Controller } from './controller';
import { snapshot } from './store';
import { svgDocument } from './files';
import { fontsForExport } from '../fonts';
import { IMAGE_TYPES } from '../images';
import { bindingKeys } from '../connectors';
import { expandGroups, groupingOptions, selectionGroup, selectionUnit } from './groups';
import { visibleElements } from './layers';
import { NOTE_BACKGROUND } from '../notes';

export function selectionWithChildren(elements: Element[], ids: Set<string>) {
  const selected = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of elements) if (!selected.has(element.id) && (element.frameId && selected.has(element.frameId) || element.containerId && selected.has(element.containerId))) {
      selected.add(element.id); changed = true;
    }
  }
  return elements.filter(element => selected.has(element.id));
}

export function copyElements(elements: Element[], offset: Point, preserveGroups: string[] = []): Element[] {
  const ids = new Map(elements.map(element => [element.id, uid()]));
  const byId = new Map(elements.map(element => [element.id, element])), members = new Map<string, Set<string>>();
  for (const element of elements) for (const [index, group] of element.groupIds.entries()) {
    if ([element.containerId, element.frameId].some(id => id && byId.get(id)?.groupIds.includes(group))) continue;
    if (!members.has(group)) members.set(group, new Set());
    members.get(group)!.add(index ? element.groupIds[index - 1] : element.id);
  }
  // A copied member leaves its parent groups; complete child groups stay intact.
  const groups = new Map([...members].filter(([id, members]) => members.size > 1 || preserveGroups.includes(id)).map(([id]) => [id, preserveGroups.includes(id) ? id : uid()]));
  return elements.map(element => {
    const copy = { ...snapshot(element), id: ids.get(element.id)!, x: element.x + offset.x, y: element.y + offset.y };
    if (element.frameId) copy.frameId = ids.get(element.frameId) ?? null;
    if (element.containerId) copy.containerId = ids.get(element.containerId) ?? null;
    for (const key of bindingKeys) if (element[key]) copy[key] = ids.has(element[key]!.elementId) ? { ...element[key]!, elementId: ids.get(element[key]!.elementId)! } : null;
    copy.groupIds = element.groupIds.filter(id => groups.has(id)).map(id => groups.get(id)!);
    if (Array.isArray(element.boundElements)) copy.boundElements = element.boundElements.filter(bound => ids.has(bound.id)).map(bound => ({ ...bound, id: ids.get(bound.id)! }));
    return copy;
  });
}

export class ObjectActions {
  constructor(readonly app: Controller) {}
  selected() { return selectionWithChildren(this.app.state.elements, this.app.state.selected); }
  editable() { const elements = this.selected(); return elements.some(element => this.app.isLocked(element)) ? [] : elements; }
  copies(offset: Point) {
    const s = this.app.state, elements = this.editable();
    const member = elements.find(element => s.editingGroup && element.groupIds.includes(s.editingGroup));
    const ancestors = member && s.editingGroup ? member.groupIds.slice(member.groupIds.indexOf(s.editingGroup)) : [];
    return copyElements(elements, offset, ancestors);
  }
  select(id: string, additive = false) {
    const s = this.app.state, element = s.elements.find(element => element.id === id);
    if (!element) return;
    const parent = element.containerId && s.elements.find(parent => parent.id === element.containerId);
    if (s.editingGroup && !(parent || element).groupIds.includes(s.editingGroup)) {
      s.editingGroup = null;
      if (additive) s.selected = expandGroups(s.elements, s.selected);
    }
    const unit = selectionUnit(s.elements, id, s.editingGroup);
    if (!additive) s.selected = new Set(unit.map(element => element.id));
    else {
      const remove = unit.every(element => s.selected.has(element.id));
      for (const element of unit) if (remove) s.selected.delete(element.id); else s.selected.add(element.id);
    }
  }
  enterGroup(id: string) {
    const s = this.app.state, element = s.elements.find(element => element.id === id);
    if (!element) return false;
    const group = selectionGroup(element, s.editingGroup);
    if (!group) return false;
    s.editingGroup = group; this.select(id); return true;
  }
  exitGroup() {
    const s = this.app.state, group = s.editingGroup;
    if (!group) return false;
    const member = s.elements.find(element => element.groupIds.includes(group));
    s.editingGroup = member?.groupIds[member.groupIds.indexOf(group) + 1] ?? null;
    s.selected = new Set(s.elements.filter(element => element.groupIds.includes(group)).map(element => element.id));
    return true;
  }
  group() {
    const a = this.app, s = a.state;
    a.finishGesture();
    const elements = this.selected();
    if (elements.some(element => a.isLocked(element)) || !groupingOptions(s.elements, elements, s.editingGroup).canGroup) return;
    const id = uid();
    for (const element of elements) {
      const index = s.editingGroup ? element.groupIds.indexOf(s.editingGroup) : -1;
      element.groupIds.splice(index < 0 ? element.groupIds.length : index, 0, id);
    }
    s.selected = new Set(elements.map(element => element.id)); a.commit();
  }
  ungroup() {
    const a = this.app, s = a.state;
    a.finishGesture();
    const { canUngroup, groups } = groupingOptions(s.elements, this.selected(), s.editingGroup);
    if (!canUngroup || this.selected().some(element => a.isLocked(element))) return;
    for (const element of s.elements) element.groupIds = element.groupIds.filter(id => !groups.has(id));
    a.commit();
  }
  closeMenu(focus = true) { this.app.state.contextMenu = null; if (focus) this.app.canvas.focus({ preventScroll: true }); }
  openMenu(x: number, y: number, point: Point) {
    const a = this.app, s = a.state;
    a.text.finish(); a.finishGesture();
    const hit = [...a.visible()].reverse().find(element => pointInElementBounds(element, point, 7 / s.zoom));
    const selected = this.selected(), box = selected.length ? sceneBounds(selected) : null;
    const insideSelection = selected.length === 1 ? pointInElementBounds(selected[0], point, 7 / s.zoom) : box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
    if (hit && !s.selected.has(hit.id) && !insideSelection) this.select(hit.id);
    else if (!hit && !insideSelection) { s.selected.clear(); s.editingGroup = null; }
    s.tool = 'selection'; s.menu = false;
    s.contextMenu = { x, y, point };
    if (s.selected.size && innerWidth > 760) s.panel = true;
  }
  async writeText(text: string, success: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text); this.app.toast(success); return true;
    } catch { this.app.toast('Clipboard access is unavailable. Allow clipboard access in your browser and try again.', true); return false; }
  }
  async copy(cut = false) {
    const a = this.app, elements = snapshot(this.selected()); if (!elements.length) return;
    if (cut && elements.some(element => a.isLocked(element))) return;
    a.state.clipboard = elements;
    const text = JSON.stringify({ type: 'sketchify-clipboard', elements });
    let system = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); system = true; } } catch { /* Internal clipboard remains available when browser permissions block writes. */ }
    a.run(() => {
      if (cut) {
        const ids = new Set(elements.map(element => element.id));
        a.removeElements(ids);
      }
      a.toast(system ? cut ? 'Selection cut.' : 'Selection copied.' : 'Selection copied in this tab.');
    });
  }
  async paste(point?: Point) {
    const a = this.app;
    const insert = (elements: Element[]) => a.run(() => a.insert(elements, point));
    if (!navigator.clipboard?.readText && !navigator.clipboard?.read) { if (a.state.clipboard.length) insert(snapshot(a.state.clipboard)); else a.toast('Use ⌘v or Ctrl+v to paste from your clipboard.'); return; }
    try {
      let text = '';
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const images = items.map(item => ({ item, type: item.types.find(type => IMAGE_TYPES.includes(type)) })).filter(entry => entry.type);
        if (images.length) { await a.images.paste(await Promise.all(images.map(entry => entry.item.getType(entry.type!))), point); return; }
        const plain = items.find(item => item.types.includes('text/plain'));
        if (plain) text = await (await plain.getType('text/plain')).text();
      } else text = await navigator.clipboard.readText();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data.elements)) { const result = importScene(data); insert(result.elements); return; }
      } catch { /* Ordinary clipboard text becomes a canvas label. */ }
      if (text) a.run(() => {
        const p = point ?? a.world(a.width / 2, a.height / 2);
        const element = { ...createElement('text', p.x, p.y, snapshot(a.state.style)), text: text.slice(0, 10000) };
        a.measure(element); a.state.elements.push(element); a.state.selected = new Set([element.id]); a.commit();
      });
    } catch {
      if (a.state.clipboard.length) insert(snapshot(a.state.clipboard));
      else a.toast('Use ⌘v or Ctrl+v to paste, or allow clipboard access in your browser.', true);
    }
  }
  async copyFormat(format: 'png' | 'svg' | 'text') {
    const a = this.app, elements = snapshot(visibleElements(this.selected(), this.app.state.layers, this.app.state.elements)); if (!elements.length) return;
    if (format === 'text') { await this.writeText(elements.filter(element => element.type === 'text').map(element => element.text).join('\n'), 'Text copied.'); return; }
    try {
      if (format === 'svg') {
        const fonts = await fontsForExport(elements);
        await this.writeText(svgDocument(elements, null, a.ctx, fonts), 'SVG copied.');
      } else {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard unavailable');
        const blob = a.files.pngBlob(elements, false);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); a.toast('PNG copied.');
      }
    } catch { a.toast('Could not copy the image. Allow clipboard access or use Export image from the main menu.', true); }
  }
  copyStyles() {
    const element = this.selected()[0]; if (!element) return;
    this.app.state.styleClipboard = Object.fromEntries(Object.keys(DEFAULT_STYLE).map(key => [key, snapshot(element[key as keyof Style])])) as unknown as Style;
    this.app.toast('Styles copied.');
  }
  pasteStyles() {
    const a = this.app, style = a.state.styleClipboard; if (!style) return;
    for (const element of this.editable()) {
      Object.assign(element, snapshot(style), { roundness: element.type === 'rectangle' ? snapshot(style.roundness) : null });
      if (element.type === 'stickynote') Object.assign(element, { backgroundColor: style.backgroundColor === 'transparent' ? NOTE_BACKGROUND : style.backgroundColor, fillStyle: 'solid', roughness: 0, fontSize: Math.max(16, style.fontSize) });
      if (element.type === 'text') a.measure(element);
    }
    a.commit();
  }
  layer(direction: 'backward' | 'forward' | 'back' | 'front') {
    const a = this.app, s = a.state, selected = new Set(this.editable().map(element => element.id));
    if (direction === 'back' || direction === 'front') {
      const moving = s.elements.filter(element => selected.has(element.id)), rest = s.elements.filter(element => !selected.has(element.id));
      s.elements = direction === 'back' ? [...moving, ...rest] : [...rest, ...moving];
    } else {
      const elements = [...s.elements];
      if (direction === 'backward') {
        for (let i = 1; i < elements.length; i++) if (selected.has(elements[i].id) && !selected.has(elements[i - 1].id)) [elements[i - 1], elements[i]] = [elements[i], elements[i - 1]];
      } else {
        for (let i = elements.length - 2; i >= 0; i--) if (selected.has(elements[i].id) && !selected.has(elements[i + 1].id)) [elements[i], elements[i + 1]] = [elements[i + 1], elements[i]];
      }
      s.elements = elements;
    }
    a.commit();
  }
  flip(horizontal: boolean) {
    const a = this.app, elements = this.editable(), box = sceneBounds(elements);
    for (const element of elements) {
      const b = unrotatedBounds(element);
      if (element.type === 'image') {
        const scale = element.scale ?? [1, 1];
        element.scale = horizontal ? [-scale[0], scale[1]] : [scale[0], -scale[1]];
        const local = unrotatedBounds(element);
        element.angle = -element.angle;
        element.x = horizontal ? box.x * 2 + box.width - local.x - local.width : local.x;
        element.y = horizontal ? local.y : box.y * 2 + box.height - local.y - local.height;
        element.width = local.width; element.height = local.height; continue;
      }
      if (['line', 'arrow', 'freedraw'].includes(element.type)) {
        element.angle = -element.angle;
        if (horizontal) { element.x = box.x * 2 + box.width - element.x; element.width *= -1; element.points = element.points.map(([x, y]) => [-x, y]); }
        else { element.y = box.y * 2 + box.height - element.y; element.height *= -1; element.points = element.points.map(([x, y]) => [x, -y]); }
      } else {
        element.angle = -element.angle;
        if (horizontal) { element.x = box.x * 2 + box.width - b.x - b.width; element.width = b.width; }
        else { element.y = box.y * 2 + box.height - b.y - b.height; element.height = b.height; }
      }
    }
    a.commit();
  }
  wrapFrame() {
    const a = this.app, elements = this.editable(); if (!elements.length) return;
    const b = sceneBounds(elements), frame = { ...createElement('frame', b.x - 24, b.y - 24), width: b.width + 48, height: b.height + 48, name: 'Frame', roughness: 0, strokeWidth: 1, strokeColor: '#73737d' };
    const selectedIds = new Set(elements.map(element => element.id));
    const index = a.state.elements.findIndex(element => selectedIds.has(element.id));
    a.state.elements.splice(index, 0, frame);
    for (const element of elements) if (!element.frameId || !selectedIds.has(element.frameId)) element.frameId = frame.id;
    a.state.selected = new Set([frame.id]); a.commit();
  }
  unbindText() {
    const a = this.app, ids = new Set(this.editable().map(element => element.id));
    for (const text of a.state.elements) if (text.type === 'text' && text.containerId && !text.locked && (ids.has(text.id) || ids.has(text.containerId))) {
      const parent = a.state.elements.find(element => element.id === text.containerId);
      if (parent && !parent.locked) {
        if (Array.isArray(parent.boundElements)) parent.boundElements = parent.boundElements.filter(bound => bound.id !== text.id);
        text.containerId = null; delete text.textWidth; a.measure(text);
      }
    }
    a.commit();
  }
  toggleLock() {
    const s = this.app.state, elements = this.selected(), locked = !elements.every(element => this.app.isLocked(element));
    for (const element of elements) {
      element.locked = locked;
      if (!locked) {
        for (const key of [`e:${element.id}`, ...element.groupIds.map(id => `g:${id}`)]) if (s.layers[key]?.locked) s.layers[key].locked = false;
      }
    }
    this.app.commit();
  }
  openLink() {
    const elements = this.editable(); if (!elements.length) return;
    this.app.state.objectLink = { ids: elements.map(element => element.id), value: elements.length === 1 ? elements[0].link ?? '' : '', error: '' };
    this.app.openDialog('object-link');
  }
  applyLink(value: string) {
    const a = this.app, pending = a.state.objectLink; if (!pending) return;
    const link = value.trim() ? safeTextLink(value) : '';
    if (value.trim() && !link) { pending.error = 'Enter a valid web or email address.'; return; }
    for (const element of a.state.elements) if (pending.ids.includes(element.id) && !element.locked) element.link = link || null;
    a.closeDialog(); a.state.objectLink = null; a.commit();
  }
  async copyLink() {
    const element = this.selected()[0]; if (!element) return;
    const url = new URL(window.location.href); url.hash = `object=${encodeURIComponent(element.id)}`;
    await this.writeText(url.href, 'Object link copied. Opens this object in the drawing saved in this browser.');
  }
  followObjectLink() {
    const a = this.app; if (!window.location.hash.startsWith('#object=')) return;
    let id: string; try { id = decodeURIComponent(window.location.hash.slice(8)); } catch { return; }
    const element = a.state.elements.find(element => element.id === id); if (!element) return;
    const b = bounds(element); a.state.editingGroup = null; a.state.selected = expandGroups(a.state.elements, new Set([element.id])); a.state.tool = 'selection';
    a.state.pan = { x: a.width / 2 - (b.x + b.width / 2) * a.state.zoom, y: a.height / 2 - (b.y + b.height / 2) * a.state.zoom };
    a.persistence.schedule();
  }
  execute(action: string) {
    const point = this.app.state.contextMenu ? snapshot(this.app.state.contextMenu.point) : undefined; this.closeMenu();
    switch (action) {
      case 'cut': void this.copy(true); break;
      case 'copy': void this.copy(); break;
      case 'paste': void this.paste(point); break;
      case 'copy-png': case 'copy-svg': case 'copy-text': void this.copyFormat(action.slice(5) as 'png' | 'svg' | 'text'); break;
      case 'copy-styles': this.copyStyles(); break;
      case 'paste-styles': this.pasteStyles(); break;
      case 'backward': case 'forward': case 'back': case 'front': this.layer(action); break;
      case 'flip-horizontal': this.flip(true); break;
      case 'flip-vertical': this.flip(false); break;
      case 'wrap-frame': this.wrapFrame(); break;
      case 'group': this.group(); break;
      case 'ungroup': this.ungroup(); break;
      case 'unbind-text': this.unbindText(); break;
      case 'lock': this.toggleLock(); break;
      case 'object-link': this.openLink(); break;
      case 'copy-object-link': void this.copyLink(); break;
      default: this.app.action(action);
    }
  }
}
