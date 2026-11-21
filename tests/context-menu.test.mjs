import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { createApp } from './helpers/app.mjs';
import { copyElements, selectionWithChildren } from '../src/whiteboard/object-actions.ts';
import { exportScene, importScene } from '../src/scene.ts';

const rectangle = (id, x = 400, y = 250, extra = {}) => ({ id, type: 'rectangle', x, y, width: 160, height: 100, ...extra });
const menu = app => app.get('object-context-menu');
const item = (app, action) => app.document.querySelector(`[data-context-action="${action}"]`);
function open(app, x = 450, y = 290) { return app.dispatch(app.canvas, 'contextmenu', { clientX: x, clientY: y }); }
function choose(app, action) { const button = item(app, action); assert.equal(button.disabled, false, `${action} must be available`); app.click(button); }
async function asyncChoose(app, action) { await act(async () => choose(app, action)); }
function selectAll(app) { app.canvas.focus(); app.key('a', { ctrlKey: true }); }
function clipboard(app, read = '') {
  const writes = [];
  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: {
    writeText: async text => { writes.push(text); }, readText: async () => read,
    write: async items => { writes.push(items); },
  } });
  return writes;
}

test('right-click selects objects, retains multi-selection and dismisses with keyboard or outside clicks', () => {
  const app = createApp({ savedElements: [rectangle('one'), rectangle('two', 700)] });
  assert.equal(open(app).defaultPrevented, true); assert.equal(menu(app).hidden, false);
  assert.equal(app.get('selection-info').textContent, '1 selected');
  assert.equal(app.document.activeElement, item(app, 'cut'));
  app.key('End'); assert.equal(app.document.activeElement, item(app, 'delete'));
  app.key('Home'); app.key('ArrowDown'); assert.equal(app.document.activeElement, item(app, 'copy'));
  app.key('Escape'); assert.equal(menu(app).hidden, true); assert.equal(app.document.activeElement, app.canvas);
  assert.equal(app.get('selection-info').textContent, '1 selected');
  selectAll(app); open(app); assert.equal(app.get('selection-info').textContent, '2 selected');
  app.click(app.get('menu-button')); assert.equal(menu(app).hidden, true);
  open(app, 1100, 600); assert.equal(item(app, 'delete').disabled, true); assert.equal(item(app, 'paste').disabled, false);
  app.key('Escape'); app.canvas.focus(); app.key('a', { ctrlKey: true }); app.key('F10', { shiftKey: true });
  assert.equal(menu(app).hidden, false);
});

test('duplicate, layer steps, front/back and delete operate on the right-clicked object and support undo', () => {
  const app = createApp({ savedElements: [rectangle('one'), rectangle('two', 700), rectangle('three', 1000)] });
  open(app, 750); choose(app, 'backward'); assert.deepEqual(app.scene().map(e => e.id), ['two', 'one', 'three']);
  open(app, 750); choose(app, 'forward'); assert.deepEqual(app.scene().map(e => e.id), ['one', 'two', 'three']);
  open(app, 750); choose(app, 'front'); assert.deepEqual(app.scene().map(e => e.id), ['one', 'three', 'two']);
  open(app, 750); choose(app, 'back'); assert.deepEqual(app.scene().map(e => e.id), ['two', 'one', 'three']);
  open(app, 750); choose(app, 'duplicate'); const copied = app.scene().at(-1);
  assert.notEqual(copied.id, 'two'); assert.equal(copied.x, 720);
  open(app, 750); choose(app, 'delete'); assert.equal(app.scene().length, 3);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 4);
});

test('locking prevents movement, resizing, erasure, deletion and style edits until unlocked', () => {
  const app = createApp({ savedElements: [rectangle('one')] });
  open(app); choose(app, 'lock'); const locked = app.scene()[0]; assert.equal(locked.locked, true);
  app.key('ArrowRight'); app.key('Delete'); assert.deepEqual(app.scene(), [locked]);
  app.click(app.property('strokeWidth', 4)); assert.deepEqual(app.scene(), [locked]);
  app.dispatch(app.canvas, 'pointerdown', { clientX: 560, clientY: 350 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 650, clientY: 400 }); app.dispatch(app.canvas, 'pointerup');
  assert.deepEqual(app.scene(), [locked]);
  app.tool('eraser'); app.click(app.canvas, { clientX: 400, clientY: 290 }); assert.deepEqual(app.scene(), [locked]);
  open(app); assert.equal(item(app, 'lock').textContent.startsWith('Unlock'), true); assert.equal(item(app, 'delete').disabled, true);
  choose(app, 'lock'); assert.equal(app.scene()[0].locked, false);
  open(app); choose(app, 'delete'); assert.deepEqual(app.scene(), []);
});

test('frames move and duplicate with their children and persist through export/import', () => {
  const app = createApp({ savedElements: [rectangle('one'), rectangle('two', 650)] });
  selectAll(app); open(app); choose(app, 'wrap-frame');
  const original = app.scene(), frame = original[0]; assert.equal(frame.type, 'frame');
  assert.ok(original.slice(1).every(element => element.frameId === frame.id));
  app.dispatch(app.canvas, 'pointerdown', { clientX: frame.x, clientY: frame.y + 50 });
  app.dispatch(app.canvas, 'pointermove', { clientX: frame.x + 30, clientY: frame.y + 70 }); app.dispatch(app.canvas, 'pointerup');
  const moved = app.scene(); for (let i = 0; i < moved.length; i++) { assert.equal(moved[i].x, original[i].x + 30); assert.equal(moved[i].y, original[i].y + 20); }
  open(app, moved[0].x, moved[0].y + 50); choose(app, 'duplicate');
  const copied = app.scene().slice(3); assert.equal(copied.length, 3); assert.equal(copied[0].type, 'frame');
  assert.ok(copied.slice(1).every(element => element.frameId === copied[0].id)); assert.notEqual(copied[0].id, frame.id);
  const restored = importScene(exportScene(app.scene())); assert.equal(restored.skipped, 0); assert.equal(restored.elements[0].type, 'frame');
});

test('copy/cut/paste preserve relationships and paste at the menu position', async () => {
  const app = createApp({ savedElements: [rectangle('one')] }), writes = clipboard(app);
  open(app); await asyncChoose(app, 'copy'); assert.equal(JSON.parse(writes[0]).elements[0].id, 'one');
  const payload = writes[0]; Object.defineProperty(app.window.navigator.clipboard, 'readText', { value: async () => payload });
  open(app, 800, 500); await asyncChoose(app, 'paste'); assert.equal(app.scene().length, 2); assert.equal(app.scene()[1].x, 800); assert.equal(app.scene()[1].y, 500);
  open(app, 850, 540); await asyncChoose(app, 'cut'); assert.equal(app.scene().length, 1);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 2);
});

test('copy as SVG and text writes selection content and copy as PNG writes a real image', async t => {
  const app = createApp({ savedElements: [{ id: 'label', type: 'text', x: 400, y: 250, text: 'Canvas text', fontFamily: 2, fontSize: 24 }] });
  const writes = clipboard(app); open(app, 420, 260); await asyncChoose(app, 'copy-text'); assert.equal(writes.at(-1), 'Canvas text');
  open(app, 420, 260); await asyncChoose(app, 'copy-svg'); assert.match(writes.at(-1), /<svg/); assert.match(writes.at(-1), /Canvas text/);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem');
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: class { constructor(data) { this.data = data; } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'ClipboardItem', previous); else delete globalThis.ClipboardItem; });
  open(app, 420, 260); await asyncChoose(app, 'copy-png');
  const png = await writes.at(-1)[0].data['image/png']; assert.equal(png.type, 'image/png'); assert.ok(png.size > 100);
});

test('copy styles and paste styles preserve selected geometry', () => {
  const app = createApp({ savedElements: [rectangle('one', 400, 250, { strokeColor: '#c92a2a', strokeWidth: 4 }), rectangle('two', 700)] });
  open(app); choose(app, 'copy-styles'); open(app, 750); choose(app, 'paste-styles');
  const element = app.scene()[1]; assert.equal(element.strokeColor, '#c92a2a'); assert.equal(element.strokeWidth, 4); assert.equal(element.x, 700);
});

test('flip mirrors line points and multi-selection positions without changing seeds', () => {
  const app = createApp({ savedElements: [{ id: 'line', type: 'arrow', x: 400, y: 250, width: 160, height: 100, points: [[0, 0], [160, 100]], seed: 17 }] });
  open(app); choose(app, 'flip-horizontal'); let element = app.scene()[0];
  assert.equal(element.x, 560); assert.deepEqual(element.points, [[0, 0], [-160, 100]]); assert.equal(element.seed, 17);
  open(app); choose(app, 'flip-vertical'); element = app.scene()[0]; assert.equal(element.y, 350); assert.deepEqual(element.points, [[0, 0], [-160, -100]]);
});

test('unbind text clears both ends of an imported binding and undo restores it', () => {
  const app = createApp({ savedElements: [rectangle('box', 400, 250, { boundElements: [{ id: 'label', type: 'text' }] }), { id: 'label', type: 'text', x: 430, y: 270, text: 'Bound', containerId: 'box', textWidth: 100 }] });
  open(app, 410, 290); choose(app, 'unbind-text'); const elements = app.scene();
  assert.deepEqual(elements[0].boundElements, []); assert.equal(elements[1].containerId, null); assert.equal(elements[1].textWidth, undefined);
  app.click(app.get('undo-button')); assert.equal(app.scene()[1].containerId, 'box');
});

test('object links validate, open on command-click, copy anchors and focus the object', async () => {
  const app = createApp({ savedElements: [rectangle('one')] }), writes = clipboard(app);
  open(app); choose(app, 'object-link'); const input = app.get('object-url'); assert.equal(app.document.activeElement, input);
  input.value = 'javascript:alert(1)'; app.dispatch(input.closest('form'), 'submit'); assert.match(app.get('object-link-error').textContent, /valid/);
  input.value = 'https://example.com/'; app.dispatch(input.closest('form'), 'submit'); assert.equal(app.scene()[0].link, 'https://example.com/');
  app.click(app.canvas, { clientX: 400, clientY: 300, ctrlKey: true }); assert.equal(app.opened[0][0], 'https://example.com/');
  open(app); await asyncChoose(app, 'copy-object-link'); assert.match(writes.at(-1), /#object=one$/);
  app.window.history.replaceState(null, '', writes.at(-1)); app.dispatch(app.window, 'hashchange');
  assert.equal(app.get('selection-info').textContent, '1 selected');
});

test('copy remaps nested frame and bound-text IDs and clears outside relationships', () => {
  const app = createApp({ savedElements: [rectangle('box', 400, 250, { boundElements: [{ id: 'text', type: 'text' }], frameId: 'outside' }), { id: 'text', type: 'text', text: 'Bound', containerId: 'box' }] });
  const elements = app.scene(), selected = selectionWithChildren(elements, new Set(['box'])); assert.equal(selected.length, 2);
  const copies = copyElements(selected, { x: 20, y: 30 });
  assert.equal(copies[0].frameId, null); assert.equal(copies[1].containerId, copies[0].id); assert.equal(copies[0].boundElements[0].id, copies[1].id);
});
