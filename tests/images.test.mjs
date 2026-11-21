import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setTimeout as delay } from 'node:timers/promises';
import { createCanvas, Image, loadImage } from '@napi-rs/canvas';
import { createApp } from './helpers/app.mjs';
import { bounds, createElement, exportScene, hitTest, importScene, rotatePoint, unrotatedBounds } from '../src/scene.ts';
import { readImage, isImageData, MAX_IMAGE_BYTES } from '../src/images.ts';
import { svgDocument } from '../src/whiteboard/files.ts';
import { selectionHandles, pickHandle } from '../src/whiteboard/canvas.ts';
import { initialState } from '../src/whiteboard/store.ts';

const fixture = createCanvas(80, 40), ctx = fixture.getContext('2d');
ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 40, 40); ctx.fillStyle = '#0000ff'; ctx.fillRect(40, 0, 40, 40);
const bytes = fixture.toBuffer('image/png'), data = `data:image/png;base64,${bytes.toString('base64')}`;
function imageApp(options) { const app = createApp(options); app.window.Image = Image; app.scene(); return app; }
async function paste(app, blobs = [new Blob([bytes], { type: 'image/png' })], extra = {}) {
  let event;
  await act(async () => {
    event = app.dispatch(app.document, 'paste', { clipboardData: {
      items: blobs.map(blob => ({ kind: 'file', type: blob.type, getAsFile: () => blob })),
      files: blobs, getData: () => 'https://example.com/copied-image.png', ...extra,
    } });
    for (let i = 0; i < 100 && !app.pendingSaves(); i++) await delay(5);
  });
  return event;
}
function action(app, name, element = app.scene()[0]) {
  app.dispatch(app.canvas, 'contextmenu', { clientX: element.x + 5, clientY: element.y + 5 });
  app.click(app.document.querySelector(`[data-context-action="${name}"]`));
}

test('clipboard image takes precedence over its URL, renders pixels and supports undo/redo', async () => {
  const app = imageApp(); const event = await paste(app);
  assert.equal(event.defaultPrevented, true); const element = app.scene()[0];
  assert.equal(element.type, 'image'); assert.equal(element.width, 80); assert.equal(element.height, 40);
  assert.equal(element.imageData, data); assert.deepEqual(element.scale, [1, 1]);
  assert.deepEqual([...app.canvas.getContext('2d').getImageData(element.x + 5, element.y + 5, 1, 1).data], [255, 0, 0, 255]);
  for (let x = element.x + 12; x < element.x + element.width - 12; x++) {
    const border = [...app.canvas.getContext('2d').getImageData(x, element.y - 1, 1, 1).data];
    assert.notDeepEqual(border, [255, 255, 255, 255], 'the selection outline must be continuous');
  }
  assert.equal(hitTest(element, { x: element.x + 40, y: element.y + 20 }), true);
  assert.equal([...app.document.querySelectorAll('.prop-label')].some(label => label.textContent === 'Sloppiness'), false);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), []);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[0], element);
});

test('images move, keep their aspect ratio when resized, and duplicate with embedded pixels', async () => {
  const app = imageApp(); await paste(app); const original = app.scene()[0];
  app.dispatch(app.canvas, 'pointerdown', { clientX: original.x + 30, clientY: original.y + 20 });
  app.dispatch(app.canvas, 'pointermove', { clientX: original.x + 60, clientY: original.y + 40 }); app.dispatch(app.canvas, 'pointerup');
  const moved = app.scene()[0]; assert.equal(moved.x, original.x + 30); assert.equal(moved.y, original.y + 20);
  app.dispatch(app.canvas, 'pointerdown', { clientX: moved.x + moved.width, clientY: moved.y + moved.height });
  app.dispatch(app.canvas, 'pointermove', { clientX: moved.x + 160, clientY: moved.y + 55 }); app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene()[0]; assert.equal(resized.width, 160); assert.equal(resized.height, 80);
  action(app, 'duplicate', resized); assert.equal(app.scene().length, 2); assert.equal(app.scene()[1].imageData, data);
});

test('pasted images reload locally and use embedded files in editable and SVG exports', async () => {
  const app = imageApp(); await paste(app); const original = app.scene()[0];
  const reloaded = imageApp({ savedElements: app.scene() }); assert.deepEqual(reloaded.scene()[0], original);
  const exported = JSON.parse(exportScene([original])); assert.equal(exported.files[original.id].dataURL, data);
  assert.equal(exported.elements[0].imageData, undefined); assert.equal(exported.elements[0].fileId, original.id);
  const imported = importScene(exported); assert.equal(imported.skipped, 0); assert.equal(imported.elements[0].imageData, data);
  const svg = svgDocument([original], null, app.canvas.getContext('2d')); assert.match(svg, /<image /); assert.ok(svg.includes(data));
});

test('image pixels survive PNG exports and flip horizontally and vertically', async () => {
  const app = imageApp(); await paste(app); const original = app.scene()[0];
  action(app, 'flip-horizontal'); let flipped = app.scene()[0]; assert.deepEqual(flipped.scale, [-1, 1]);
  assert.deepEqual([...app.canvas.getContext('2d').getImageData(flipped.x + 5, flipped.y + 5, 1, 1).data], [0, 0, 255, 255]);
  action(app, 'flip-vertical'); flipped = app.scene()[0]; assert.deepEqual(flipped.scale, [-1, -1]);
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]'));
  app.click(app.document.querySelector('[data-export="png"]'));
  assert.equal(app.downloads.at(-1).type, 'image/png'); assert.ok(app.downloads.at(-1).size > 100);
  assert.equal(original.width, flipped.width);
});

test('right-click Paste reads image clipboard items and inserts at the menu position', async () => {
  const app = imageApp();
  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: { read: async () => [{ types: ['image/png'], getType: async () => new Blob([bytes], { type: 'image/png' }) }] } });
  await act(async () => {
    app.dispatch(app.canvas, 'contextmenu', { clientX: 400, clientY: 250 });
    app.click(app.document.querySelector('[data-context-action="paste"]'));
    for (let i = 0; i < 100 && !app.pendingSaves(); i++) await delay(5);
  });
  const element = app.scene()[0]; assert.equal(element.type, 'image'); assert.equal(element.x, 400); assert.equal(element.y, 250);
});

test('image paste inside the text editor does not create a canvas image or HTML image', async () => {
  const app = imageApp(); app.tool('text'); app.click(app.canvas, { clientX: 400, clientY: 250 });
  const event = app.dispatch(app.editor, 'paste', { clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => new Blob([bytes], { type: 'image/png' }) }], getData: () => '' } });
  assert.equal(event.defaultPrevented, true); assert.equal(app.scene().length, 0); assert.equal(app.editor.querySelector('img'), null);
});

test('image decoding rejects invalid, oversized and remote sources without changing the drawing', async () => {
  const app = imageApp();
  await assert.rejects(readImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }), /larger than/);
  await assert.rejects(readImage(new Blob(['not an image'], { type: 'image/png' })), /decoded/);
  assert.equal(isImageData('https://example.com/picture.png'), false);
  const bad = { ...createElement('image', 0, 0), width: 100, height: 100, imageData: 'https://example.com/picture.png' };
  assert.equal(importScene({ elements: [bad] }).skipped, 1);
  assert.deepEqual(app.scene(), []);
});

function geometry(element, zoom = 1) {
  const b = unrotatedBounds(element), center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const handle = rotatePoint({ x: center.x, y: b.y - 32 / zoom }, center, element.angle);
  return { center, handle };
}
function rotate(app, element, delta, shiftKey = false) {
  const { center, handle } = geometry(element);
  const end = rotatePoint(handle, center, delta);
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y, shiftKey });
  app.dispatch(app.canvas, 'pointerup'); return app.scene()[0];
}

test('image rotation uses a circular handle and commits one undo step without moving its center', async () => {
  const app = imageApp(); await paste(app); const original = app.scene()[0];
  const rotated = rotate(app, original, Math.PI / 2);
  assert.ok(Math.abs(rotated.angle - Math.PI / 2) < 1e-10);
  assert.equal(rotated.x, original.x); assert.equal(rotated.y, original.y);
  assert.equal(rotated.width, original.width); assert.equal(rotated.height, original.height);
  const b = bounds(rotated); assert.ok(Math.abs(b.width - 40) < 1e-8); assert.ok(Math.abs(b.height - 80) < 1e-8);
  const { center } = geometry(original);
  assert.deepEqual([...app.canvas.getContext('2d').getImageData(center.x, center.y - 25, 1, 1).data], [255, 0, 0, 255]);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0], original);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[0], rotated);
});

for (const pressed of [true, false]) test(`Shift ${pressed ? 'press' : 'release'} updates rotation snapping without pointer movement`, async () => {
  const app = imageApp(); await paste(app); const original = app.scene()[0], { center, handle } = geometry(original);
  const end = rotatePoint(handle, center, 22 * Math.PI / 180);
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y, shiftKey: !pressed });
  app.dispatch(app.document, pressed ? 'keydown' : 'keyup', { key: 'Shift', shiftKey: pressed });
  app.dispatch(app.canvas, 'pointerup');
  assert.ok(Math.abs(app.scene()[0].angle - (pressed ? 15 : 22) * Math.PI / 180) < 1e-10);
});

test('rotation cancels cleanly and locked images have no resize or rotation handles', async () => {
  const app = imageApp(); await paste(app); const original = app.scene()[0], { center, handle } = geometry(original);
  app.dispatch(app.canvas, 'pointerdown', { clientX: handle.x, clientY: handle.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: center.x + 100, clientY: center.y }); app.dispatch(app.canvas, 'pointercancel');
  assert.deepEqual(app.scene()[0], original);
  const state = { ...initialState(), elements: [{ ...original, locked: true }], selected: new Set([original.id]) };
  assert.equal(pickHandle(state, handle), undefined);
});

for (const corner of ['nw', 'ne', 'se', 'sw']) test(`rotated image ${corner} resizing preserves the opposite corner and aspect ratio`, async () => {
  const app = imageApp(); await paste(app); const original = rotate(app, app.scene()[0], Math.PI / 3);
  const state = { ...initialState(), elements: [original], selected: new Set([original.id]) };
  const handles = selectionHandles(state), start = handles.find(handle => handle.key === corner);
  const opposite = handles.find(handle => handle.key === ({ nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' })[corner]);
  const end = { x: opposite.x + (start.x - opposite.x) * 1.5, y: opposite.y + (start.y - opposite.y) * 1.5 };
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y }); app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene()[0], after = selectionHandles({ ...state, elements: [resized] }).find(handle => handle.key === opposite.key);
  assert.ok(Math.abs(resized.width - original.width * 1.5) < 1e-8);
  assert.ok(Math.abs(resized.height - original.height * 1.5) < 1e-8);
  assert.ok(Math.hypot(after.x - opposite.x, after.y - opposite.y) < 1e-8); assert.equal(resized.angle, original.angle);
});

test('rotation handles keep a fixed screen distance at different zoom levels and use rotated hit testing', async () => {
  const initial = imageApp(); await paste(initial); const original = initial.scene()[0];
  for (const zoom of [.5, 2]) {
    const element = { ...original, angle: Math.PI / 4 };
    const state = { ...initialState(), elements: [element], selected: new Set([element.id]), zoom };
    const rotateHandle = selectionHandles(state).find(handle => handle.key === 'rotate');
    const { center } = geometry(element);
    assert.ok(Math.abs(Math.hypot(rotateHandle.x - center.x, rotateHandle.y - center.y) * zoom - (element.height / 2 * zoom + 32)) < 1e-8);
    assert.equal(pickHandle(state, rotateHandle).key, 'rotate');
    const box = bounds(element); assert.equal(hitTest(element, { x: box.x + 1, y: box.y + 1 }, 0), false); assert.equal(hitTest(element, center, 0), true);
  }
});

test('rotated images reload and export with their angle and complete PNG and SVG bounds', async () => {
  const app = imageApp(); await paste(app); const rotated = rotate(app, app.scene()[0], Math.PI / 2);
  const reloaded = imageApp({ savedElements: [rotated] }); assert.equal(reloaded.scene()[0].angle, rotated.angle);
  const imported = importScene(exportScene([rotated])); assert.equal(imported.skipped, 0); assert.equal(imported.elements[0].angle, rotated.angle);
  const svg = svgDocument([rotated], null, app.canvas.getContext('2d')); assert.match(svg, /rotate\(90 /);
  app.click(app.get('menu-button')); app.click(app.document.querySelector('[data-action="export"]')); app.click(app.document.querySelector('[data-export="png"]'));
  const png = await loadImage(new Uint8Array(await app.downloads.at(-1).arrayBuffer()));
  assert.equal(png.width, 176); assert.equal(png.height, 256);
  const output = createCanvas(png.width, png.height), ctx = output.getContext('2d'); ctx.drawImage(png, 0, 0);
  assert.deepEqual([...ctx.getImageData(88, 68, 1, 1).data], [255, 0, 0, 255]);
  assert.deepEqual([...ctx.getImageData(88, 168, 1, 1).data], [0, 0, 255, 255]);
});
