import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { createElement, exportScene, importScene, rotatePoint } from '../src/scene.ts';
import { layout, svg } from '../src/text.ts';
import { fitBoundText } from '../src/bound-text.ts';
import { selectionHandles } from '../src/whiteboard/canvas.ts';
import { initialState } from '../src/whiteboard/store.ts';

const shape = { id: 'rectangle', type: 'rectangle', x: 400, y: 240, width: 340, height: 240 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001, `${actual} should equal ${expected}`);
const selected = (app, id = shape.id) => app.click(app.canvas, { clientX: app.scene().find(element => element.id === id).x, clientY: app.scene().find(element => element.id === id).y + 50 });
const label = app => {
  app.dispatch(app.canvas, 'dblclick', { clientX: 570, clientY: 240 });
  app.input('Longer line\nShort'); app.key('Enter', { ctrlKey: true });
};
function aligned(parent, text, ctx) {
  const center = { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };
  const textCenter = rotatePoint({ x: text.x + text.width / 2, y: text.y + text.height / 2 }, center, -parent.angle);
  close(textCenter.x, center.x);
  close(textCenter.y, text.verticalAlign === 'top' ? parent.y + 16 + text.height / 2 : text.verticalAlign === 'bottom' ? parent.y + parent.height - 16 - text.height / 2 : center.y);
  const measured = layout(text, ctx);
  for (const run of measured.segments) {
    const width = ctx.measureText(run.text.trimEnd()).width;
    close(run.x, text.textAlign === 'center' ? (text.width - width) / 2 : text.textAlign === 'right' ? text.width - width : 0);
  }
  assert.equal(text.angle, parent.angle);
}

test('standalone text aligns unequal lines at natural and explicit widths, including rich spans and SVG', () => {
  const ctx = { font: '', textBaseline: 'top', measureText: text => ({ width: text.length * 10, actualBoundingBoxDescent: 24 }) };
  for (const textWidth of [undefined, 160]) for (const textAlign of ['left', 'center', 'right']) {
    const text = { ...createElement('text', 30, 50), text: 'Long line\nShort', textAlign, textWidth, textSpans: [{ start: 10, end: 14, bold: true, link: 'https://example.com/' }] };
    const measured = layout(text, ctx), short = measured.segments[1];
    close(short.x, textAlign === 'left' ? 0 : (measured.width - 50) / (textAlign === 'center' ? 2 : 1));
    close(measured.segments[2].x, short.x + 40);
    assert.match(svg(text, ctx), new RegExp(`x="${text.x + short.x}"`));
  }
});

for (const angle of [0, Math.PI / 3]) for (const textAlign of ['left', 'center', 'right']) for (const verticalAlign of ['top', 'middle', 'bottom']) {
  test(`rectangle label ${textAlign}/${verticalAlign} positions at angle ${angle}`, () => {
    const app = createApp();
    const parent = { ...createElement('rectangle', 400, 240), width: 340, height: 240, angle };
    const text = { ...createElement('text', 0, 0), text: 'Longer line\nShort', containerId: parent.id, textAlign, verticalAlign };
    fitBoundText(text, parent, app.canvas.getContext('2d')); aligned(parent, text, app.canvas.getContext('2d'));
    const saved = importScene(exportScene([parent, text])).elements;
    assert.equal(saved[1].textAlign, textAlign); assert.equal(saved[1].verticalAlign, verticalAlign);
    assert.deepEqual(saved[1].text, text.text);
  });
}

test('standalone alignment controls update drafts, selected text, undo and reload; no vertical controls', () => {
  const app = createApp(); app.tool('text');
  assert.equal(app.property('textAlign', 'left').getAttribute('aria-pressed'), 'true');
  assert.equal(app.property('verticalAlign', 'top'), null);
  app.click(app.property('textAlign', 'right')); app.click(app.canvas, { clientX: 400, clientY: 240 });
  app.input('Longer line\nShort'); assert.equal(app.editor.style.textAlign, 'right');
  app.click(app.property('textAlign', 'center')); assert.equal(app.document.activeElement, app.editor);
  assert.equal(app.editor.style.textAlign, 'center'); app.key('Enter', { ctrlKey: true });
  const original = app.scene(); assert.equal(original[0].textAlign, 'center');
  app.click(app.property('textAlign', 'right')); const right = app.scene(); assert.equal(right[0].textAlign, 'right');
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), original);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene(), right);
  const reload = createApp({ savedElements: right }); selected(reload, right[0].id);
  assert.equal(reload.property('textAlign', 'right').getAttribute('aria-pressed'), 'true');
});

test('rectangle alignment can be set before adding text, preserves edits and supports cancelling', () => {
  const app = createApp({ savedElements: [shape] }); selected(app);
  assert.equal(app.property('textAlign', 'center').getAttribute('aria-pressed'), 'true');
  assert.equal(app.property('verticalAlign', 'middle').getAttribute('aria-pressed'), 'true');
  app.click(app.property('textAlign', 'right')); app.click(app.property('verticalAlign', 'bottom')); label(app);
  let elements = app.scene(); aligned(...elements, app.canvas.getContext('2d'));
  assert.equal(elements[1].textAlign, 'right'); assert.equal(elements[1].verticalAlign, 'bottom');
  app.key('Enter'); assert.equal(app.editor.style.textAlign, 'right');
  app.click(app.property('textAlign', 'left')); app.click(app.property('verticalAlign', 'top'));
  app.key('Escape'); assert.deepEqual(app.scene(), elements);
  app.key('Enter'); app.click(app.property('textAlign', 'left')); app.click(app.property('verticalAlign', 'top'));
  app.key('Enter', { ctrlKey: true }); elements = app.scene(); aligned(...elements, app.canvas.getContext('2d'));
  assert.equal(elements[0].textAlign, 'left'); assert.equal(elements[0].verticalAlign, 'top');
  const reload = createApp({ savedElements: elements }); selected(reload);
  assert.equal(reload.property('textAlign', 'left').getAttribute('aria-pressed'), 'true');
  assert.equal(reload.property('verticalAlign', 'top').getAttribute('aria-pressed'), 'true');
});

test('standalone alignment preferences do not change new rectangle defaults, including file round-trips', () => {
  const app = createApp(); app.tool('text'); app.click(app.property('textAlign', 'right'));
  app.tool('rectangle'); app.dispatch(app.canvas, 'pointerdown', { clientX: 400, clientY: 240 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 740, clientY: 480 }); app.dispatch(app.canvas, 'pointerup');
  assert.equal(app.property('textAlign', 'center').getAttribute('aria-pressed'), 'true');
  const imported = importScene(exportScene(app.scene())).elements;
  const reload = createApp({ savedElements: imported }); label(reload);
  assert.equal(reload.scene()[1].textAlign, 'center'); assert.equal(reload.scene()[1].verticalAlign, 'middle');
});

test('non-centered rectangle labels follow dragging, resizing, rotation, duplication and undo', () => {
  const app = createApp({ savedElements: [shape] }); label(app);
  app.click(app.property('textAlign', 'right')); app.click(app.property('verticalAlign', 'bottom'));
  const initial = app.scene();
  // Clicking the label must move its rectangle, rather than detach the text.
  app.dispatch(app.canvas, 'pointerdown', { clientX: initial[1].x + initial[1].width - 30, clientY: initial[1].y + 10 });
  app.dispatch(app.canvas, 'pointermove', { clientX: initial[1].x + initial[1].width, clientY: initial[1].y + 30 }); app.dispatch(app.canvas, 'pointerup');
  let elements = app.scene(); close(elements[0].x, initial[0].x + 30); close(elements[0].y, initial[0].y + 20); aligned(...elements, app.canvas.getContext('2d'));
  let handles = selectionHandles({ ...initialState(), elements, selected: new Set([shape.id]) });
  const handle = handles.find(handle => handle.key === 'se');
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: handle.x + 80, clientY: handle.y + 40 }); app.dispatch(app.canvas, 'pointerup');
  elements = app.scene(); close(elements[0].width, initial[0].width + 80); aligned(...elements, app.canvas.getContext('2d'));
  handles = selectionHandles({ ...initialState(), elements, selected: new Set([shape.id]) });
  const rotation = handles.find(handle => handle.key === 'rotate'), parent = elements[0];
  app.dispatch(app.canvas, 'pointerdown', { clientX: rotation.x, clientY: rotation.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: parent.x + parent.width + 100, clientY: parent.y + parent.height / 2 }); app.dispatch(app.canvas, 'pointerup');
  elements = app.scene(); close(elements[0].angle, Math.PI / 2); aligned(...elements, app.canvas.getContext('2d'));
  app.key('d', { ctrlKey: true }); const duplicated = app.scene(); assert.equal(duplicated.length, 4);
  aligned(...duplicated.slice(2), app.canvas.getContext('2d')); assert.equal(duplicated[3].containerId, duplicated[2].id);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), elements);
});

test('alignment controls are restricted to standalone text and rectangles, including bound-label editing', () => {
  for (const type of ['ellipse', 'diamond', 'line', 'arrow', 'freedraw', 'frame']) {
    const app = createApp({ savedElements: [{ ...shape, type }] }); selected(app);
    assert.equal(app.property('textAlign', 'left'), null); assert.equal(app.property('verticalAlign', 'top'), null);
    if (['ellipse', 'diamond'].includes(type)) {
      label(app); app.key('Enter'); assert.equal(app.property('textAlign', 'left'), null); app.key('Escape');
    }
  }
});

test('multi-selected rectangle labels show mixed alignment and update together without changing locked labels', () => {
  const second = { ...shape, id: 'second', x: 850, textAlign: 'right', verticalAlign: 'bottom' };
  const app = createApp({ savedElements: [shape, second] }); selected(app);
  app.click(app.canvas, { clientX: 850, clientY: 290, shiftKey: true });
  for (const value of ['left', 'center', 'right']) assert.equal(app.property('textAlign', value).getAttribute('aria-pressed'), 'false');
  app.click(app.property('textAlign', 'left')); app.click(app.property('verticalAlign', 'top'));
  for (const element of app.scene()) { assert.equal(element.textAlign, 'left'); assert.equal(element.verticalAlign, 'top'); }
  const locked = createApp({ savedElements: [{ ...shape, locked: true }] });
  locked.dispatch(locked.canvas, 'contextmenu', { clientX: 400, clientY: 290 });
  const control = locked.property('textAlign', 'right'); assert.ok(control?.disabled);
  const before = locked.scene(); locked.click(control); assert.deepEqual(locked.scene(), before);
});
