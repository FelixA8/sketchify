import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createApp } from './helpers/app.mjs';
import { bounds, createElement, exportScene, hitTest, importScene, normalizeAngle, rotatePoint, sceneBounds, unrotatedBounds } from '../src/scene.ts';
import { initialState } from '../src/whiteboard/store.ts';
import { selectionHandles, drawElement } from '../src/whiteboard/canvas.ts';
import { svgDocument } from '../src/whiteboard/files.ts';
import { layout, linkAt } from '../src/text.ts';

const types = ['rectangle', 'ellipse', 'diamond', 'line', 'freedraw', 'text', 'frame'];
function element(type, extra = {}) {
  return { ...createElement(type, 400, 250, { fontFamily: 2, roughness: 0, backgroundColor: '#ffec99', fillStyle: 'solid', seed: 17 }),
    id: type, width: 160, height: 80, text: type === 'text' ? 'Rotate this label' : '',
    ...(['line', 'arrow', 'freedraw'].includes(type) ? { points: [[0, 0], [80, 20], [160, 80]] } : {}), ...extra };
}
const center = element => { const b = unrotatedBounds(element); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`);
function select(app) { app.canvas.focus(); app.key('a', { ctrlKey: true }); }
function rotate(app, originals, delta, selectedIds = originals.map(element => element.id)) {
  const state = { ...initialState(), elements: originals, selected: new Set(selectedIds) };
  const selected = originals.filter(element => selectedIds.includes(element.id));
  const b = selected.length === 1 ? unrotatedBounds(selected[0]) : sceneBounds(selected), c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const start = selectionHandles(state).find(handle => handle.key === 'rotate'), end = rotatePoint(start, c, delta);
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y }); app.dispatch(app.canvas, 'pointerup');
  return app.scene();
}

for (const type of types) test(`${type} has a working rotation handle, one undo step and persistent angle`, () => {
  const app = createApp({ savedElements: [element(type)] }); select(app); const original = app.scene()[0];
  const rotated = rotate(app, [original], Math.PI / 3)[0];
  close(rotated.angle, Math.PI / 3); close(center(rotated).x, center(original).x); close(center(rotated).y, center(original).y);
  assert.equal(rotated.seed, original.seed); assert.deepEqual(rotated.points, original.points);
  close(importScene(exportScene([rotated])).elements[0].angle, rotated.angle);
  const reload = createApp({ savedElements: [rotated] }); close(reload.scene()[0].angle, rotated.angle);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0], original);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[0], rotated);
});

for (const type of types) test(`rotated ${type} can resize from a corner without moving the opposite corner`, () => {
  const app = createApp({ savedElements: [element(type)] }); select(app);
  const original = rotate(app, app.scene(), Math.PI / 4)[0];
  const state = { ...initialState(), elements: [original], selected: new Set([original.id]) };
  const handles = selectionHandles(state), start = handles.find(handle => handle.key === 'se'), fixed = handles.find(handle => handle.key === 'nw');
  const end = { x: fixed.x + (start.x - fixed.x) * 1.5, y: fixed.y + (start.y - fixed.y) * 1.5 };
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y }); app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene()[0], after = selectionHandles({ ...state, elements: [resized] }).find(handle => handle.key === 'nw');
  close(after.x, fixed.x); close(after.y, fixed.y); close(resized.angle, original.angle);
  if (type === 'text') assert.ok(Math.abs(unrotatedBounds(resized).width - unrotatedBounds(original).width * 1.5) < .01);
  else close(unrotatedBounds(resized).width, unrotatedBounds(original).width * 1.5);
});

test('multi-selection rotation moves every object around the common center and is undoable', () => {
  const app = createApp({ savedElements: [element('rectangle'), element('ellipse', { x: 700, angle: Math.PI / 6 })] }); select(app);
  const original = app.scene(), b = sceneBounds(original), c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const rotated = rotate(app, original, Math.PI / 2);
  for (let i = 0; i < original.length; i++) {
    const expected = rotatePoint(center(original[i]), c, Math.PI / 2), actual = center(rotated[i]);
    close(actual.x, expected.x); close(actual.y, expected.y); close(rotated[i].angle, normalizeAngle(original[i].angle + Math.PI / 2));
  }
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), original);
});

test('rotating a frame includes child objects and bound text, and frame resizing preserves their angles', () => {
  const app = createApp({ savedElements: [element('frame', { x: 350, y: 200, width: 400, height: 220 }), element('rectangle', { frameId: 'frame', boundElements: [{ id: 'text', type: 'text' }] }), element('text', { x: 430, y: 270, containerId: 'rectangle', frameId: 'frame' })] });
  app.dispatch(app.canvas, 'contextmenu', { clientX: 350, clientY: 300 }); app.key('Escape');
  const original = app.scene(), c = center(original[0]); const rotated = rotate(app, original, Math.PI / 3, ['frame']);
  for (let i = 0; i < rotated.length; i++) { const expected = rotatePoint(center(original[i]), c, Math.PI / 3); close(center(rotated[i]).x, expected.x); close(center(rotated[i]).y, expected.y); close(rotated[i].angle, Math.PI / 3); }
  const state = { ...initialState(), elements: rotated, selected: new Set(['frame']) }, handles = selectionHandles(state);
  const fixed = handles.find(handle => handle.key === 'nw'), start = handles.find(handle => handle.key === 'se');
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: fixed.x + (start.x - fixed.x) * 1.25, clientY: fixed.y + (start.y - fixed.y) * 1.25 }); app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene(); close(resized[0].width, rotated[0].width * 1.25);
  for (let i = 0; i < resized.length; i++) close(resized[i].angle, rotated[i].angle);
});

test('rotated text edits at its angle, preserves its leading corner and supports cancel', () => {
  const app = createApp({ savedElements: [element('text')] }); select(app); const original = rotate(app, app.scene(), Math.PI / 4)[0];
  const c = center(original), anchor = rotatePoint({ x: original.x, y: original.y }, c, original.angle);
  app.dispatch(app.canvas, 'dblclick', { clientX: c.x, clientY: c.y });
  assert.ok(app.editor.style.transform.includes(`rotate(${original.angle}rad)`));
  app.input('A much longer rotated label'); app.key('Enter', { ctrlKey: true });
  const edited = app.scene()[0], nextAnchor = rotatePoint({ x: edited.x, y: edited.y }, center(edited), edited.angle);
  close(nextAnchor.x, anchor.x); close(nextAnchor.y, anchor.y); close(edited.angle, original.angle);
  const next = center(edited); app.dispatch(app.canvas, 'dblclick', { clientX: next.x, clientY: next.y });
  app.input('Cancel this'); app.key('Escape'); assert.deepEqual(app.scene()[0], edited);
});

for (const side of ['w', 'e']) test(`rotated text ${side} handle wraps text in its own axes`, () => {
  const app = createApp({ savedElements: [element('text', { text: 'A long rotated label that needs to wrap onto more than one line' })] }); select(app);
  const original = rotate(app, app.scene(), Math.PI / 4)[0], state = { ...initialState(), elements: [original], selected: new Set([original.id]) };
  const start = selectionHandles(state).find(handle => handle.key === side), b = unrotatedBounds(original), c = center(original);
  const fixed = rotatePoint({ x: side === 'w' ? b.x + b.width : b.x, y: b.y }, c, original.angle);
  const end = rotatePoint({ x: side === 'w' ? b.x + b.width - 120 : b.x + 120, y: b.y + b.height / 2 }, c, original.angle);
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y }); app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene()[0]; close(resized.textWidth, 120); close(resized.angle, original.angle); assert.equal(resized.fontSize, original.fontSize);
  const after = rotatePoint({ x: side === 'w' ? resized.x + resized.width : resized.x, y: resized.y }, center(resized), resized.angle);
  close(after.x, fixed.x); close(after.y, fixed.y);
});

test('canvas, SVG and PNG use the same rotated vector geometry and complete export bounds', async () => {
  const app = createApp({ savedElements: [element('rectangle', { strokeColor: '#ff0000', backgroundColor: '#ff0000' })] }); select(app);
  const rotated = rotate(app, app.scene(), Math.PI / 2)[0], b = bounds(rotated);
  close(b.width, 80); close(b.height, 160);
  const output = createCanvas(900, 700), ctx = output.getContext('2d'); drawElement(rotated, ctx, { theme: 'light', background: '#ffffff' });
  assert.deepEqual([...ctx.getImageData(center(rotated).x, center(rotated).y - 60, 1, 1).data], [255, 0, 0, 255]);
  const svg = svgDocument([rotated], null, ctx); assert.match(svg, /rotate\(90 /);
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]')); app.click(app.document.querySelector('[data-export="png"]'));
  const png = await loadImage(new Uint8Array(await app.downloads.at(-1).arrayBuffer())); assert.equal(png.width, 256); assert.equal(png.height, 416);
});

test('rotated rich-text links use their rendered location for hit testing', () => {
  const app = createApp({ savedElements: [element('text', { textSpans: [{ start: 0, end: 16, link: 'https://example.com/' }] })] }); select(app);
  const rotated = rotate(app, app.scene(), Math.PI / 3)[0], run = layout(rotated, app.canvas.getContext('2d')).segments[0];
  const point = rotatePoint({ x: rotated.x + run.x + run.width / 2, y: rotated.y + run.y + 10 }, center(rotated), rotated.angle);
  assert.equal(linkAt(rotated, point, app.canvas.getContext('2d')), 'https://example.com/');
  assert.equal(hitTest(rotated, point), true);
  app.click(app.canvas, { clientX: point.x, clientY: point.y, ctrlKey: true }); assert.equal(app.opened[0][0], 'https://example.com/');
});

for (const vertical of [false, true]) test(`a ${vertical ? 'vertical' : 'horizontal'} straight line rotates and resizes without invalid coordinates`, () => {
  const app = createApp({ savedElements: [element('line', { width: vertical ? 0 : 160, height: vertical ? 160 : 0, points: [[0, 0], vertical ? [0, 160] : [160, 0]] })] }); select(app);
  const original = rotate(app, app.scene(), Math.PI / 4)[0];
  const state = { ...initialState(), elements: [original], selected: new Set([original.id]) }, handles = selectionHandles(state);
  const start = handles.find(handle => handle.key === 'se'), fixed = handles.find(handle => handle.key === 'nw');
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: fixed.x + (start.x - fixed.x) * 1.5, clientY: fixed.y + (start.y - fixed.y) * 1.5, shiftKey: true }); app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene()[0], b = unrotatedBounds(resized); close(vertical ? b.height : b.width, 240); close(vertical ? b.width : b.height, 0);
  assert.ok(resized.points.flat().every(Number.isFinite));
});
