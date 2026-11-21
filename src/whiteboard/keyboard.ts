import { createElement, importScene } from '../scene';
import { snapshot } from './store';
import type { Controller } from './controller';
import { tools } from './tools';
import { IMAGE_TYPES } from '../images';
import { expandGroups } from './groups';
import { finishFlowchart, isFlowchartDirection, previewFlowchart } from './flowchart';
export function mountKeyboard(a: Controller) {
  a.listen(document, 'keydown', event => { if (event.key === 'Tab') event.preventDefault(); }, { capture: true });
  const typing = () => { const active = document.activeElement as HTMLElement; return active?.isContentEditable || active === a.get('text-editor') || /INPUT|TEXTAREA|SELECT/.test(active?.tagName) || a.state.dialog; };
  for (const type of ['copy', 'cut'] as const) a.listen(document, type, event => {
    if (typing() || !a.state.selected.size) return;
    if (type === 'cut' && a.objects.selected().some(element => a.isLocked(element))) return;
    a.state.clipboard = snapshot(a.objects.selected()); event.clipboardData!.setData('text/plain', JSON.stringify({ type: 'sketchify-clipboard', elements: a.state.clipboard })); event.preventDefault();
    if (type === 'cut') a.removeSelected();
  });
  a.listen(document, 'paste', event => {
    if (typing() || !event.clipboardData) return;
    const data = event.clipboardData;
    const images = [...(data.items || [])].filter(item => item.kind === 'file' && IMAGE_TYPES.includes(item.type)).map(item => item.getAsFile()).filter((file): file is File => !!file);
    if (!images.length) images.push(...[...(data.files || [])].filter(file => IMAGE_TYPES.includes(file.type)));
    if (images.length) { event.preventDefault(); void a.images.paste(images); return; }
    const text = data.getData('text/plain'); if (!text) return;
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data.elements)) { const imported = importScene(data); a.insert(imported.elements); if (imported.skipped) a.toast(`Pasted supported shapes; ${imported.skipped} unsupported elements were skipped.`); event.preventDefault(); return; }
    } catch { /* Ordinary clipboard text becomes an editable canvas label. */ }
    const p = a.world(a.width / 2, a.height / 2), element = { ...createElement('text', p.x, p.y, snapshot(a.state.style)), text: text.slice(0, 10000) };
    a.measure(element); a.state.elements.push(element); a.state.selected = new Set([element.id]); a.commit(); event.preventDefault();
  });
  a.listen(document, 'keydown', event => {
    if (typing()) return; const s = a.state, key = event.key.toLowerCase(), command = event.metaKey || event.ctrlKey;
    if (key === 'escape' && finishFlowchart(a, true)) { event.preventDefault(); return; }
    if (command && !event.shiftKey && !event.altKey && isFlowchartDirection(event.key)) {
      if (previewFlowchart(a, event.key)) event.preventDefault();
      return;
    }
    if (!['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) finishFlowchart(a);
    if ((key === ' ' || key === 'enter') && (document.activeElement as HTMLElement)?.closest('button, summary')) return;
    const shortcut = event.altKey && /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.altKey && event.code === 'BracketLeft' ? '[' : event.altKey && event.code === 'BracketRight' ? ']' : key;
    if ((event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') && s.selected.size) {
      const b = a.objects.selected()[0], x = b.x * s.zoom + s.pan.x, y = b.y * s.zoom + s.pan.y;
      event.preventDefault(); a.objects.openMenu(x, y, { x: b.x, y: b.y }); return;
    }
    if (!command && event.shiftKey && event.altKey && shortcut === 'c') { event.preventDefault(); a.objects.execute('copy-png'); return; }
    if (!command && event.shiftKey && ['h', 'v'].includes(key)) { event.preventDefault(); a.objects.execute(key === 'h' ? 'flip-horizontal' : 'flip-vertical'); return; }
    if (s.contextMenu && !command) return;
    if (!command && event.altKey && shortcut === 'z') { event.preventDefault(); a.togglePreference('zenMode'); return; }
    if (key === 'escape') {
      if (s.preferences.zenMode) { event.preventDefault(); a.togglePreference('zenMode'); return; }
      a.finishGesture(true); s.menu = false; s.tool = 'selection'; if (!a.objects.exitGroup()) s.selected.clear(); return;
    }
    if (command) {
      if (key === 'z') { event.preventDefault(); a.history(event.shiftKey ? 'redo' : 'undo'); }
      else if (key === 'y') { event.preventDefault(); a.history('redo'); }
      else if (key === 'a') { event.preventDefault(); s.tool = 'selection'; s.selected = expandGroups(a.visible(), new Set(a.interactive().filter(e => !s.editingGroup || e.groupIds.includes(s.editingGroup)).map(e => e.id)), s.editingGroup); if (innerWidth > 760) s.panel = true; }
      else if (event.altKey && ['c', 'v'].includes(shortcut)) { event.preventDefault(); a.objects.execute(shortcut === 'c' ? 'copy-styles' : 'paste-styles'); }
      else if (shortcut === '[' || shortcut === ']') { event.preventDefault(); a.objects.execute(shortcut === '[' ? event.altKey ? 'back' : 'backward' : event.altKey ? 'front' : 'forward'); }
      else if (key === 'l' && event.shiftKey) { event.preventDefault(); a.objects.execute('lock'); }
      else if (key === 'k') { event.preventDefault(); a.objects.execute('object-link'); }
      else if (key === 'd') { event.preventDefault(); a.duplicate(); }
      else if (key === 'g' && !event.altKey) { event.preventDefault(); if (!event.repeat) a.objects.execute(event.shiftKey ? 'ungroup' : 'group'); }
      else if (key === 's') { event.preventDefault(); a.files.save(); }
      else if (key === 'o') { event.preventDefault(); a.get<HTMLInputElement>('open-file').click(); }
      else if (key === "'") { event.preventDefault(); a.action('grid'); }
      else if (key === '+' || key === '=') { event.preventDefault(); a.zoom(s.zoom * 1.2); }
      else if (key === '-') { event.preventDefault(); a.zoom(s.zoom / 1.2); }
      return;
    }
    if (key === ' ') { event.preventDefault(); s.space = true; return; }
    if (event.shiftKey && (key === '!' || key === '1')) { event.preventDefault(); a.fit(); return; }
    if (event.shiftKey && (key === ')' || key === '0')) { event.preventDefault(); a.zoom(1); return; }
    if (key === '?') { a.openDialog('help'); return; }
    if (key === 'enter' && document.activeElement === a.canvas) { a.keyboardInsert(); event.preventDefault(); return; }
    if (['backspace', 'delete'].includes(key)) { event.preventDefault(); a.removeSelected(); return; }
    if (key.startsWith('arrow') && s.selected.size) {
      event.preventDefault(); const step = event.shiftKey ? 10 : 1;
      const originals = snapshot(a.objects.editable());
      for (const e of a.objects.editable()) { e.x += key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0; e.y += key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0; }
      a.rebindConnectors(originals);
      a.commit(); return;
    }
    if (key === 'q') { s.locked = !s.locked; return; }
    const tool = tools.find(([, , number, shortcut]) => key === number || key === shortcut.toLowerCase()); if (tool) { event.preventDefault(); a.setTool(tool[0]); }
  });
  a.listen(document, 'keyup', event => { if (event.code === 'Space') a.state.space = false; });
  a.listen(document, 'keyup', event => { if (!event.metaKey && !event.ctrlKey) finishFlowchart(a); });
  a.listen(document, 'pointerdown', () => { finishFlowchart(a); }, { capture: true });
  a.listen(window, 'blur', () => { finishFlowchart(a, true); });
}
