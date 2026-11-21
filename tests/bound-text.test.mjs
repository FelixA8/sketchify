import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { createElement, exportScene, importScene, rotatePoint } from '../src/scene.ts';
import { layout } from '../src/text.ts';
import { selectionHandles } from '../src/whiteboard/canvas.ts';
import { initialState } from '../src/whiteboard/store.ts';

const shape = (type = 'rectangle', extra = {}) => ({ id: 'shape', type, x: 400, y: 240, width: 300, height: 160, backgroundColor: 'transparent', ...extra });
const doubleClick = (app, x, y) => {
  if (x === undefined) {
    const parent = app.scene()[0], center = { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };
    ({ x, y } = rotatePoint({ x: center.x, y: parent.y }, center, parent.angle));
  }
  return app.dispatch(app.canvas, 'dblclick', { clientX: x, clientY: y });
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001, `${actual} should equal ${expected}`);
function centered(parent, text) {
  close(text.x + text.width / 2, parent.x + parent.width / 2);
  close(text.y + text.height / 2, parent.y + parent.height / 2);
  assert.equal(text.angle, parent.angle);
  assert.ok(text.width < parent.width); assert.ok(text.height < parent.height);
}

for (const type of ['rectangle', 'ellipse', 'diamond']) test(`double-clicking an unfilled ${type} border creates one centered, wrapped label`, () => {
  const app = createApp({ savedElements: [shape(type)] });
  doubleClick(app); assert.equal(app.document.activeElement, app.editor);
  assert.equal(app.editor.style.textAlign, 'center');
  app.input('Blender MCP + Claude/Codex'); app.key('Enter', { ctrlKey: true });
  const [parent, text] = app.scene(); centered(parent, text);
  assert.equal(text.containerId, parent.id); assert.deepEqual(parent.boundElements, [{ id: text.id, type: 'text' }]);
  assert.equal(text.text, 'Blender MCP + Claude/Codex');
  const measured = layout(text, app.canvas.getContext('2d'));
  assert.ok(measured.height > text.fontSize * 1.25);
  doubleClick(app, parent.x + parent.width / 2, parent.y + parent.height / 2);
  assert.equal(app.editor.textContent, text.text); app.input('Edited label'); app.key('Enter', { metaKey: true });
  assert.equal(app.scene().length, 2); assert.equal(app.scene()[1].id, text.id);
});

test('cancel discards shape growth, empty labels and style changes; save is one undo step', () => {
  const app = createApp({ savedElements: [shape()] }); const original = app.scene();
  doubleClick(app); app.input('Very long label\n'.repeat(20)); app.click(app.property('fontSize', 48)); app.key('Escape');
  assert.deepEqual(app.scene(), original);
  doubleClick(app); app.input('Very long label\n'.repeat(20)); app.key('Enter', { ctrlKey: true });
  const labeled = app.scene(); assert.ok(labeled[0].height > original[0].height); centered(...labeled);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), original);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene(), labeled);
  doubleClick(app); app.input(''); app.key('Enter', { ctrlKey: true });
  assert.equal(app.scene().length, 1); assert.deepEqual(app.scene()[0].boundElements, []);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), labeled);
});

test('labels follow dragging, free resizing, keyboard movement, duplication and reload', () => {
  const app = createApp({ savedElements: [shape()] });
  doubleClick(app); app.input('Attached text'); app.key('Enter', { ctrlKey: true });
  const original = app.scene();
  app.dispatch(app.canvas, 'pointerdown', { clientX: 550, clientY: 320 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 580, clientY: 340 }); app.dispatch(app.canvas, 'pointerup');
  let elements = app.scene(); close(elements[0].x, original[0].x + 30); centered(...elements);
  const handle = selectionHandles({ ...initialState(), elements, selected: new Set(['shape']) }).find(handle => handle.key === 'se');
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: handle.x + 100, clientY: handle.y + 15 }); app.dispatch(app.canvas, 'pointerup');
  elements = app.scene(); close(elements[0].width, 400); close(elements[0].height, 175);
  assert.equal(elements[1].fontSize, original[1].fontSize); centered(...elements);
  app.canvas.focus(); app.key('ArrowRight'); centered(...app.scene());
  app.key('d', { ctrlKey: true }); elements = app.scene(); assert.equal(elements.length, 4);
  centered(...elements.slice(2)); assert.equal(elements[3].containerId, elements[2].id);
  const reloaded = createApp({ savedElements: elements }); assert.deepEqual(reloaded.scene(), elements);
  const imported = importScene(exportScene(elements)).elements;
  assert.equal(imported[1].textAlign, 'center'); assert.equal(imported[1].verticalAlign, 'middle');
  assert.equal(imported[1].containerId, imported[0].id);
});

test('keyboard edits shape labels, while the text tool creates separate text and locked borders remain unchanged', () => {
  const app = createApp({ savedElements: [shape()] });
  app.click(app.canvas, { clientX: 400, clientY: 280 }); app.key('Enter');
  assert.equal(app.document.activeElement, app.editor); app.input('Keyboard label'); app.key('Enter', { ctrlKey: true });
  app.tool('text'); app.click(app.canvas, { clientX: 420, clientY: 260 });
  assert.equal(app.editor.textContent, ''); app.input('Separate text'); app.key('Enter', { ctrlKey: true });
  assert.equal(app.scene().length, 3); assert.equal(app.scene()[1].text, 'Keyboard label'); assert.ok(!app.scene()[2].containerId);
  const locked = createApp({ savedElements: [shape('rectangle', { locked: true })] });
  doubleClick(locked); assert.equal(locked.editor.hidden, true); assert.equal(locked.scene().length, 1);
});

for (const type of ['rectangle', 'ellipse', 'diamond']) for (const backgroundColor of ['transparent', '#ffc9c9']) {
  test(`T-click creates independent text inside and on the border of a ${backgroundColor === 'transparent' ? 'unfilled' : 'filled'} ${type}`, () => {
    const app = createApp({ savedElements: [shape(type, { backgroundColor })] });
    const original = app.scene()[0];
    for (const y of [320, 240]) {
      app.canvas.focus(); app.key('t'); app.click(app.canvas, { clientX: 550, clientY: y });
      assert.equal(app.document.activeElement, app.editor); assert.equal(app.editor.textContent, '');
      app.input('Independent'); app.key('Enter', { ctrlKey: true });
    }
    const elements = app.scene(); assert.equal(elements.length, 3); assert.deepEqual(elements[0], original);
    for (const text of elements.slice(1)) { assert.ok(!text.containerId); assert.equal(text.x, 550); assert.equal(text.text, 'Independent'); }
    app.click(app.get('undo-button')); assert.equal(app.scene().length, 2);
    app.click(app.get('redo-button')); assert.deepEqual(app.scene(), elements);
    const reloaded = createApp({ savedElements: elements }); assert.deepEqual(reloaded.scene(), elements);
    reloaded.click(reloaded.canvas, { clientX: 400, clientY: 320 });
    reloaded.key('Delete');
    assert.deepEqual(reloaded.scene(), elements.slice(1));
  });

  test(`double-clicking the interior of a ${backgroundColor === 'transparent' ? 'unfilled' : 'filled'} ${type} creates separate text; its border creates a label`, () => {
    const app = createApp({ savedElements: [shape(type, { backgroundColor })] });
    doubleClick(app, 550, 320); app.input('Separate'); app.key('Enter', { ctrlKey: true });
    let elements = app.scene(); assert.ok(!elements[1].containerId); assert.ok(!elements[0].boundElements?.length);
    doubleClick(app); app.input('Attached'); app.key('Enter', { ctrlKey: true });
    elements = app.scene(); assert.equal(elements.length, 3);
    assert.equal(elements[2].containerId, elements[0].id); centered(elements[0], elements[2]);
    app.canvas.focus(); app.key('t'); app.click(app.canvas, { clientX: elements[2].x + 10, clientY: elements[2].y + 10 });
    assert.equal(app.editor.textContent, ''); app.input('Over label'); app.key('Enter', { ctrlKey: true });
    assert.deepEqual(app.scene().slice(0, 3), elements); assert.ok(!app.scene()[3].containerId);
  });
}

test('rotated shapes keep centered labels and preserve them when resize is cancelled', () => {
  const app = createApp({ savedElements: [shape('rectangle', { angle: Math.PI / 4 })] });
  doubleClick(app); app.input('Rotated label'); app.key('Enter', { ctrlKey: true });
  const original = app.scene(); centered(...original);
  const handle = selectionHandles({ ...initialState(), elements: original, selected: new Set(['shape']) }).find(handle => handle.key === 'se');
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: handle.x + 80, clientY: handle.y + 80 }); app.key('Escape');
  assert.deepEqual(app.scene(), original);
});

for (const type of ['rectangle', 'ellipse', 'diamond']) for (const zoom of [.5, 2]) {
  test(`rotated filled ${type} distinguishes its interior from its border at zoom ${zoom}`, () => {
    const pan = { x: 30, y: -20 };
    const app = createApp({ savedElements: [shape(type, { angle: Math.PI / 4, backgroundColor: '#ffc9c9' })], zoom, pan });
    const parent = app.scene()[0], center = { x: 550, y: 320 };
    doubleClick(app, center.x * zoom + pan.x, center.y * zoom + pan.y);
    app.input('Separate'); app.key('Enter', { ctrlKey: true });
    assert.ok(!app.scene()[1].containerId);
    const border = rotatePoint({ x: center.x, y: parent.y + 6 / zoom }, center, parent.angle);
    doubleClick(app, border.x * zoom + pan.x, border.y * zoom + pan.y);
    app.input('Attached'); app.key('Enter', { ctrlKey: true });
    const elements = app.scene(); assert.equal(elements[2].containerId, parent.id); centered(elements[0], elements[2]);
  });
}

test('erasing a shape removes its label and undo restores both ends of the binding', () => {
  const app = createApp({ savedElements: [shape()] });
  doubleClick(app); app.input('Erase together'); app.key('Enter', { ctrlKey: true });
  const original = app.scene();
  app.tool('eraser'); app.click(app.canvas, { clientX: 400, clientY: 280 });
  assert.deepEqual(app.scene(), []);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), original);
});

test('centered labels wrap at a slash and center each visible line independently', () => {
  const text = { ...createElement('text', 0, 0), text: 'Blender MCP + Claude/Codex', textWidth: 220, textAlign: 'center' };
  const ctx = { font: '', textBaseline: 'top', measureText: value => ({ width: value.length * 10, actualBoundingBoxDescent: 24 }) };
  const measured = layout(text, ctx);
  assert.deepEqual(measured.segments.map(run => run.text), ['Blender MCP + Claude/', 'Codex']);
  for (const run of measured.segments) close(run.x + run.width / 2, text.textWidth / 2);
  text.text = 'First line wraps here'; text.textWidth = 150;
  const wrapped = layout(text, ctx);
  for (const run of wrapped.segments) close(run.x + run.text.trimEnd().length * 10 / 2, text.textWidth / 2);
});
