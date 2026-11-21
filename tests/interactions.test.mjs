import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { readFileSync } from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { layout } from '../src/text.ts';
import { drawElement } from '../src/whiteboard/canvas.ts';
GlobalFonts.register(readFileSync(new URL('../public/fonts/patrick-hand/PatrickHand-Regular.ttf', import.meta.url)), 'Patrick Hand');
function draw(app, type, start = { x: 400, y: 250 }, end = { x: 560, y: 350 }, modifiers = {}) {
  app.tool(type);
  app.dispatch(app.canvas, 'pointerdown', { clientX: start.x, clientY: start.y, pointerId: 1, ...modifiers });
  app.dispatch(app.canvas, 'pointermove', { clientX: end.x, clientY: end.y, pointerId: 1, ...modifiers });
  app.dispatch(app.canvas, 'pointerup', { pointerId: 1 });
}
test('every drawing tool inserts seeded geometry and completed gestures create one undo step', () => {
  const app = createApp();
  for (const type of ['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw']) draw(app, type);
  assert.deepEqual(app.scene().map(e => e.type), ['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw']);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 5);
  app.click(app.get('redo-button')); assert.equal(app.scene().length, 6);
});
test('move, resize, cancellation and nudge preserve seeds and history', () => {
  const app = createApp(); draw(app, 'rectangle'); const original = app.scene()[0];
  app.dispatch(app.canvas, 'pointerdown', { clientX: 450, clientY: 290 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 480, clientY: 310 });
  app.dispatch(app.canvas, 'pointerup');
  assert.equal(app.scene()[0].x, original.x + 30); assert.equal(app.scene()[0].seed, original.seed);
  app.dispatch(app.canvas, 'pointerdown', { clientX: 590, clientY: 370 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 650, clientY: 400 });
  app.dispatch(app.canvas, 'pointercancel');
  assert.equal(app.scene()[0].width, original.width);
  app.dispatch(app.canvas, 'pointerdown', { clientX: 590, clientY: 370 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 650, clientY: 400 });
  app.dispatch(app.canvas, 'pointerup');
  assert.equal(app.scene()[0].width, 220); assert.equal(app.scene()[0].height, 130);
  app.key('ArrowRight', { shiftKey: true }); assert.equal(app.scene()[0].x, original.x + 40);
  app.click(app.get('undo-button')); assert.equal(app.scene()[0].x, original.x + 30);
});
for (const type of ['rectangle', 'ellipse', 'diamond', 'line', 'arrow']) {
  for (const pressed of [true, false]) test(`Shift ${pressed ? 'press' : 'release'} immediately updates a stationary ${type} drawing`, () => {
    const app = createApp(); app.tool(type);
    app.dispatch(app.canvas, 'pointerdown', { clientX: 400, clientY: 250 });
    app.dispatch(app.canvas, 'pointermove', { clientX: 560, clientY: 350, shiftKey: !pressed });
    app.dispatch(app.document, pressed ? 'keydown' : 'keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: pressed });
    app.dispatch(app.canvas, 'pointerup');
    const element = app.scene()[0];
    if (pressed) assert.ok(Math.abs(element.width - element.height) < 1e-8);
    else { assert.equal(element.width, 160); assert.equal(element.height, 100); }
    if (['line', 'arrow'].includes(type)) assert.deepEqual(element.points, [[0, 0], [element.width, element.height]]);
    app.click(app.get('undo-button')); assert.deepEqual(app.scene(), []);
  });
}
for (const kind of ['move', 'resize']) {
  for (const pressed of [true, false]) test(`Shift ${pressed ? 'press' : 'release'} immediately updates a stationary ${kind}`, () => {
    const app = createApp(); draw(app, 'rectangle'); const original = app.scene()[0];
    const start = kind === 'move' ? { clientX: 450, clientY: 290 } : { clientX: 560, clientY: 350 };
    const end = kind === 'move' ? { clientX: 480, clientY: 310 } : { clientX: 620, clientY: 380 };
    app.dispatch(app.canvas, 'pointerdown', start);
    app.dispatch(app.canvas, 'pointermove', { ...end, shiftKey: !pressed });
    app.dispatch(app.document, pressed ? 'keydown' : 'keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: pressed });
    app.dispatch(app.canvas, 'pointerup'); const element = app.scene()[0];
    if (kind === 'move') { assert.equal(element.x, original.x + 30); assert.equal(element.y, original.y + (pressed ? 0 : 20)); }
    else { assert.equal(element.width, 220); assert.equal(element.height, pressed ? 137.5 : 130); }
    assert.equal(element.seed, original.seed);
    app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0], original);
  });
}
test('Shift does not add freehand points or affect a cancelled gesture', () => {
  const app = createApp(); app.tool('freedraw');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 400, clientY: 250 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 560, clientY: 350 });
  app.key('Shift', { shiftKey: true }); app.dispatch(app.document, 'keyup', { key: 'Shift', shiftKey: false });
  app.dispatch(app.canvas, 'pointerup'); const original = app.scene()[0];
  assert.deepEqual(original.points, [[0, 0], [0, 0], [160, 100]]);
  app.tool('rectangle'); app.dispatch(app.canvas, 'pointerdown', { clientX: 700, clientY: 250 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 850, clientY: 350 }); app.key('Shift', { shiftKey: true });
  app.dispatch(app.canvas, 'pointercancel'); app.dispatch(app.document, 'keyup', { key: 'Shift', shiftKey: false });
  assert.deepEqual(app.scene(), [original]);
});
for (const corner of ['nw', 'ne', 'se', 'sw']) test(`multiline text resize at ${corner} keeps its measured border and opposite corner fixed`, () => {
  const zoom = 1.5, pan = { x: 50, y: -40 };
  const app = createApp({ zoom, pan, savedElements: [{ id: 'text', type: 'text', x: 200, y: 200, fontSize: 48, fontFamily: 1, text: 'fdsakljfdlskjfd\nfdsafsfsdf\ndsafdasf', textSpans: [{ start: 0, end: 14, bold: true }] }] });
  app.canvas.focus(); app.key('a', { ctrlKey: true }); const original = app.scene()[0];
  const west = corner.includes('w'), north = corner.includes('n');
  const start = { clientX: (original.x + (west ? 0 : original.width)) * zoom + pan.x, clientY: (original.y + (north ? 0 : original.height)) * zoom + pan.y };
  app.dispatch(app.canvas, 'pointerdown', start);
  for (const distance of [40, 100]) {
    app.dispatch(app.canvas, 'pointermove', { clientX: start.clientX + (west ? -distance : distance), clientY: start.clientY + (north ? -10 : 10) });
  }
  app.dispatch(app.canvas, 'pointerup'); const resized = app.scene()[0];
  const measured = layout(resized, app.canvas.getContext('2d'));
  assert.equal(resized.width, measured.width); assert.equal(resized.height, measured.contentHeight);
  assert.ok(resized.fontSize > original.fontSize);
  assert.ok(Math.abs((west ? resized.x + resized.width : resized.x) - (west ? original.x + original.width : original.x)) < .001);
  assert.ok(Math.abs((north ? resized.y + resized.height : resized.y) - (north ? original.y + original.height : original.y)) < .001);
  const canvas = createCanvas(Math.ceil(resized.width + 40), Math.ceil(resized.height + 120)), ctx = canvas.getContext('2d');
  drawElement({ ...resized, x: 20, y: 20 }, ctx, { theme: 'light', background: '#ffffff' });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let bottom = -1;
  for (let index = pixels.length - 1; index >= 3; index -= 4) if (pixels[index]) { bottom = Math.floor((index - 3) / 4 / canvas.width); break; }
  assert.ok(Math.abs(20 + resized.height - bottom - 1) <= 2, 'selection bottom follows the last painted line');
  const reloaded = createApp({ savedElements: app.scene() });
  assert.equal(reloaded.scene()[0].width, resized.width); assert.equal(reloaded.scene()[0].height, resized.height);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0], original);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[0], resized);
});
test('text resize respects its minimum font size and cancelling restores measured bounds', () => {
  const app = createApp({ savedElements: [{ id: 'text', type: 'text', x: 300, y: 200, fontSize: 24, text: 'Three\ntext\nlines' }] });
  app.canvas.focus(); app.key('a', { ctrlKey: true }); const original = app.scene()[0];
  app.dispatch(app.canvas, 'pointerdown', { clientX: original.x + original.width, clientY: original.y + original.height });
  app.dispatch(app.canvas, 'pointermove', { clientX: original.x, clientY: original.y });
  app.dispatch(app.canvas, 'pointerup');
  const resized = app.scene()[0], measured = layout(resized, app.canvas.getContext('2d'));
  assert.equal(resized.fontSize, 8); assert.equal(resized.width, measured.width); assert.equal(resized.height, measured.contentHeight);
  app.click(app.get('undo-button')); app.canvas.focus(); app.key('a', { ctrlKey: true });
  app.dispatch(app.canvas, 'pointerdown', { clientX: original.x + original.width, clientY: original.y + original.height });
  app.dispatch(app.canvas, 'pointermove', { clientX: original.x, clientY: original.y });
  app.dispatch(app.canvas, 'pointercancel'); assert.deepEqual(app.scene()[0], original);
});
for (const side of ['w', 'e']) test(`text ${side} handle changes wrapping width without changing font size`, () => {
  const app = createApp({ savedElements: [{ id: 'text', type: 'text', x: 300, y: 200, fontSize: 36, text: 'Sketch ideas with a handwritten text box' }] });
  app.canvas.focus(); app.key('a', { ctrlKey: true }); const original = app.scene()[0];
  app.dispatch(app.canvas, 'pointerdown', { clientX: original.x + (side === 'e' ? original.width : 0), clientY: original.y + original.height / 2 });
  app.dispatch(app.canvas, 'pointermove', { clientX: side === 'e' ? original.x + 140 : original.x + original.width - 140, clientY: 400 });
  app.dispatch(app.canvas, 'pointerup'); const resized = app.scene()[0];
  assert.equal(resized.textWidth, 140); assert.equal(resized.width, 140); assert.equal(resized.fontSize, original.fontSize);
  assert.ok(resized.height > original.height); assert.equal(resized.y, original.y);
  assert.equal(side === 'w' ? resized.x + resized.width : resized.x, side === 'w' ? original.x + original.width : original.x);
  const reloaded = createApp({ savedElements: app.scene() }); assert.deepEqual(reloaded.scene()[0], resized);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0], original);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[0], resized);
  app.canvas.focus(); app.key('a', { ctrlKey: true });
  assert.equal(app.document.querySelector('[aria-label="Text box width in pixels"]'), null);
});
test('corner scaling preserves the wrapping width and line breaks of a fixed-width text box', () => {
  const app = createApp({ savedElements: [{ id: 'text', type: 'text', x: 300, y: 200, fontSize: 24, textWidth: 180, text: 'Sketch ideas with a handwritten text box' }] });
  app.canvas.focus(); app.key('a', { ctrlKey: true }); const original = app.scene()[0];
  app.dispatch(app.canvas, 'pointerdown', { clientX: original.x + original.width, clientY: original.y + original.height });
  app.dispatch(app.canvas, 'pointermove', { clientX: original.x + original.width * 2, clientY: original.y + original.height * 2 });
  app.dispatch(app.canvas, 'pointerup'); const resized = app.scene()[0];
  assert.equal(resized.fontSize, original.fontSize * 2); assert.equal(resized.textWidth, original.textWidth * 2);
  const ctx = app.canvas.getContext('2d');
  assert.deepEqual(layout(resized, ctx).segments.map(run => run.text), layout(original, ctx).segments.map(run => run.text));
  assert.equal(resized.height, layout(resized, ctx).contentHeight);
});
test('shift selection, marquee, duplication and stacking preserve selection order', () => {
  const app = createApp(); draw(app, 'rectangle'); draw(app, 'ellipse', { x: 700, y: 250 }, { x: 860, y: 350 });
  app.click(app.canvas, { clientX: 400, clientY: 300, shiftKey: true });
  assert.equal(app.get('selection-info').textContent, '2 selected');
  app.key('d', { ctrlKey: true }); assert.equal(app.scene().length, 4);
  const copied = app.scene().slice(2).map(e => e.id);
  app.click(app.document.querySelector('[data-action="back"]')); assert.deepEqual(app.scene().slice(0, 2).map(e => e.id), copied);
  app.key('Escape');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 350, clientY: 200 });
  app.dispatch(app.canvas, 'pointermove', { clientX: 900, clientY: 400 });
  app.dispatch(app.canvas, 'pointerup'); assert.equal(app.get('selection-info').textContent, '4 selected');
});
test('eraser cancellation restores the scene and completing erasure is undoable', () => {
  const app = createApp(); draw(app, 'rectangle'); const original = app.scene(); app.tool('eraser');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 400, clientY: 300 }); app.dispatch(app.canvas, 'pointercancel');
  assert.deepEqual(app.scene(), original);
  app.dispatch(app.canvas, 'pointerdown', { clientX: 400, clientY: 300 }); app.dispatch(app.canvas, 'pointerup'); assert.deepEqual(app.scene(), []);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), original);
});
test('pan cursor follows gesture completion and keyboard pan state', () => {
  const app = createApp(); app.tool('hand');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 400, clientY: 300 }); assert.equal(app.canvas.style.cursor, 'grabbing');
  app.dispatch(app.canvas, 'pointerup'); assert.equal(app.canvas.style.cursor, 'grab');
  app.tool('selection'); app.canvas.focus(); app.key(' '); assert.equal(app.canvas.style.cursor, 'grab');
  app.dispatch(app.document, 'keyup', { key: ' ', code: 'Space' }); assert.equal(app.canvas.style.cursor, 'default');
});
test('corner rounding previews a drag, commits one undo step and reloads as the default', () => {
  const app = createApp(); draw(app, 'rectangle');
  assert.equal(app.get('corner-rounding'), null);
  app.click(app.property('rectangleEdges', 'rounded'));
  assert.equal(app.get('corner-rounding').value, '32');
  const slider = app.get('corner-rounding');
  for (const value of ['10', '25', '60']) { slider.value = value; app.dispatch(slider, 'input'); }
  app.dispatch(slider, 'change'); const elements = app.scene();
  assert.deepEqual(elements[0].roundness, { type: 3, value: 60 });
  assert.equal(app.document.querySelector('[aria-label="Corner rounding in pixels"]').value, '60');
  const stored = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1'));
  const reloaded = createApp({ savedElements: elements, savedLocal: stored.local }); draw(reloaded, 'rectangle');
  assert.deepEqual(reloaded.scene()[1].roundness, { type: 3, value: 60 });
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0].roundness, { type: 3, value: 32 });
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[0].roundness, { type: 3, value: 60 });
  app.canvas.focus(); app.key('a', { ctrlKey: true });
  app.click(app.property('rectangleEdges', 'rounded')); assert.equal(app.get('corner-rounding').value, '60');
  app.click(app.property('rectangleEdges', 'sharp')); assert.equal(app.get('corner-rounding'), null);
  assert.equal(app.scene()[0].roundness, null);
  app.click(app.property('rectangleEdges', 'rounded')); assert.equal(app.get('corner-rounding').value, '32');
});
test('mixed rounded selections show mixed rounding and apply it only to rectangles', () => {
  const app = createApp({ savedElements: [
    { id: 'custom', type: 'rectangle', x: 400, y: 200, width: 200, height: 100, roundness: { type: 3, value: 12 } },
    { id: 'rounded', type: 'rectangle', x: 700, y: 200, width: 200, height: 100, roundness: { type: 3 } },
    { id: 'ellipse', type: 'ellipse', x: 400, y: 400, width: 200, height: 100 },
  ] });
  app.canvas.focus(); app.key('a', { ctrlKey: true });
  assert.equal(app.document.querySelector('[aria-label="Corner rounding in pixels"]').placeholder, 'Mixed');
  const slider = app.get('corner-rounding'); slider.value = '18'; app.dispatch(slider, 'input'); app.dispatch(slider, 'change');
  const elements = app.scene();
  assert.deepEqual(elements.slice(0, 2).map(e => e.roundness), [{ type: 3, value: 18 }, { type: 3, value: 18 }]);
  assert.equal(elements[2].roundness, null);
  slider.value = '0'; app.dispatch(slider, 'input'); app.dispatch(slider, 'change');
  assert.deepEqual(app.scene().slice(0, 2).map(e => e.roundness), [{ type: 3, value: 0 }, { type: 3, value: 0 }]);
  assert.equal(app.property('rectangleEdges', 'rounded').getAttribute('aria-pressed'), 'true');
  assert.equal(app.get('corner-rounding').value, '0');
});
test('numeric rounding previews edits, clamps invalid limits and restores an empty field', () => {
  const app = createApp(); draw(app, 'rectangle');
  app.click(app.property('rectangleEdges', 'rounded'));
  const number = app.document.querySelector('[aria-label="Corner rounding in pixels"]');
  function edit(value) {
    Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(number, value);
    app.dispatch(number, 'input');
  }
  app.click(number); edit('1'); edit('18');
  assert.equal(app.get('corner-rounding').value, '18');
  app.key('Enter'); assert.deepEqual(app.scene()[0].roundness, { type: 3, value: 18 });
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[0].roundness, { type: 3, value: 32 });
  app.click(app.get('redo-button')); app.canvas.focus(); app.key('a', { ctrlKey: true });
  const input = app.document.querySelector('[aria-label="Corner rounding in pixels"]');
  function commit(value, expected) {
    app.click(input);
    Object.getOwnPropertyDescriptor(app.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    app.dispatch(input, 'input'); app.key('Enter');
    assert.equal(input.value, String(expected));
    assert.equal(app.get('corner-rounding').value, String(expected));
  }
  commit('999', 100); commit('', 100); commit('-4', 0);
  assert.deepEqual(app.scene()[0].roundness, { type: 3, value: 0 });
});
test('custom colors and every shape-style control update selected geometry without changing its seed', () => {
  const app = createApp(); draw(app, 'rectangle'); const seed = app.scene()[0].seed;
  const stroke = app.document.querySelector('[data-color="strokeColor"]'); stroke.value = '#123456'; app.dispatch(stroke, 'change');
  app.click(app.property('backgroundColor', '#a5d8ff'));
  app.click(app.property('fillStyle', 'cross-hatch')); app.click(app.property('strokeWidth', 4)); app.click(app.property('strokeStyle', 'dotted')); app.click(app.property('roughness', 2));
  const element = app.scene()[0];
  assert.equal(element.strokeColor, '#123456'); assert.equal(element.backgroundColor, '#a5d8ff'); assert.equal(element.fillStyle, 'cross-hatch');
  assert.equal(element.strokeWidth, 4); assert.equal(element.strokeStyle, 'dotted'); assert.equal(element.roughness, 2); assert.equal(element.seed, seed);
});
test('grid, tool lock, pan, zoom, fit and reset retain local state', () => {
  const app = createApp(); app.canvas.focus(); app.key("'", { ctrlKey: true }); draw(app, 'rectangle', { x: 403, y: 247 }, { x: 559, y: 349 });
  assert.equal(app.scene()[0].x % 20, 0); app.key('q');
  draw(app, 'ellipse'); assert.equal(app.document.querySelector('[data-tool="ellipse"]').getAttribute('aria-pressed'), 'true');
  app.dispatch(app.canvas, 'wheel', { deltaX: 30, deltaY: 40 }); app.scene();
  let local = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).local; assert.deepEqual(local.pan, { x: -30, y: -40 });
  app.click(app.get('zoom-in')); app.scene(); local = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).local; assert.equal(local.zoom, 1.2);
  app.key('!', { shiftKey: true }); app.key(')', { shiftKey: true }); assert.equal(app.get('zoom-reset').textContent, '100%');
});
test('retired library data does not affect startup, scene editing or selection controls', () => {
  for (const width of [1440, 375]) {
    const app = createApp({ width, storageEntries: { 'sketchify.library.v1': '{invalid legacy data' } });
    assert.equal(app.get('toast').hidden, true);
    draw(app, 'rectangle'); const original = app.scene()[0];
    if (width === 375) app.click(app.get('style-toggle'));
    assert.equal(app.document.querySelector('[id*="library"], [data-action="add-library"], [data-template], [data-saved]'), null);
    app.click(app.document.querySelector('[data-action="duplicate"]')); assert.equal(app.scene().length, 2);
    app.click(app.get('undo-button')); assert.deepEqual(app.scene(), [original]);
    app.dispatch(app.canvas, 'contextmenu', { clientX: original.x, clientY: original.y });
    assert.equal(app.document.querySelector('[data-context-action="add-library"]'), null);
    assert.equal(app.document.querySelector('[data-context-action="copy"]').disabled, false);
    app.key('Escape');
    assert.equal(app.window.localStorage.getItem('sketchify.library.v1'), '{invalid legacy data');
  }
});
test('keyboard copy, cut and paste reuse shapes without library storage', () => {
  const app = createApp(); draw(app, 'rectangle');
  app.click(app.property('backgroundColor', '#a5d8ff'));
  const original = app.scene()[0], values = new Map();
  const clipboardData = { setData: (type, value) => values.set(type, value), getData: type => values.get(type) || '' };
  app.canvas.focus();
  assert.equal(app.dispatch(app.document, 'copy', { clipboardData }).defaultPrevented, true);
  assert.equal(JSON.parse(values.get('text/plain')).elements[0].id, original.id);
  assert.equal(app.dispatch(app.document, 'paste', { clipboardData }).defaultPrevented, true);
  const copy = app.scene()[1];
  assert.notEqual(copy.id, original.id); assert.equal(copy.seed, original.seed); assert.equal(copy.backgroundColor, original.backgroundColor);
  assert.equal(app.dispatch(app.document, 'cut', { clipboardData }).defaultPrevented, true);
  assert.deepEqual(app.scene(), [original]);
  app.dispatch(app.document, 'paste', { clipboardData }); assert.equal(app.scene().length, 2);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), [original]);
  assert.equal(app.window.localStorage.getItem('sketchify.library.v1'), null);
});
test('storage read and write failures keep editing usable and offer file recovery', () => {
  const app = createApp({ readError: true }); assert.match(app.get('toast').textContent, /could not be read/); draw(app, 'rectangle');
  app.key('s', { ctrlKey: true }); assert.equal(app.downloads.length, 1);
  const full = createApp({ storageError: true }); draw(full, 'rectangle'); full.scene();
  assert.equal(full.get('save-state').textContent, 'Save a file to keep your work'); assert.match(full.get('toast').textContent, /Save to file/);
});
test('Strict Mode remounts do not duplicate keyboard commands, editor handlers or saves', () => {
  const app = createApp({ strict: true }); draw(app, 'rectangle'); app.key('d', { ctrlKey: true }); assert.equal(app.scene().length, 2);
  app.tool('text'); app.click(app.canvas, { clientX: 700, clientY: 400 }); app.key('b', { ctrlKey: true }); app.type('Once'); app.key('Enter', { ctrlKey: true });
  assert.equal(app.scene().length, 3); assert.deepEqual(app.scene()[2].textSpans, [{ start: 0, end: 4, bold: true }]);
});
test('autosave debounces changes and unload commits active rich text before writing', () => {
  const app = createApp(); draw(app, 'rectangle'); app.key('ArrowRight'); app.key('ArrowRight');
  assert.equal(app.get('save-state').textContent, 'Saving…'); assert.equal(app.pendingSaves(), 1);
  app.scene(); assert.equal(app.get('save-state').textContent, 'Saved on this device'); assert.equal(app.pendingSaves(), 0);
  app.tool('text'); app.click(app.canvas, { clientX: 700, clientY: 400 }); app.key('b', { ctrlKey: true }); app.type('Before unload');
  app.dispatch(app.window, 'beforeunload');
  const elements = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1')).elements;
  assert.equal(elements[1].text, 'Before unload'); assert.equal(elements[1].textSpans[0].bold, true);
});
test('narrow screens require an explicit properties toggle and menu/dialog focus returns', () => {
  const app = createApp({ width: 760, height: 700 }); app.tool('rectangle'); assert.equal(app.get('properties').hidden, true);
  app.click(app.get('style-toggle')); assert.equal(app.get('properties').hidden, false);
  app.click(app.get('menu-button')); assert.equal(app.document.activeElement.dataset.action, 'open');
  app.key('Escape'); assert.equal(app.document.activeElement, app.get('menu-button'));
  app.click(app.get('help-button')); assert.equal(app.get('dialog').open, true);
  app.dispatch(app.get('dialog'), 'cancel'); assert.equal(app.get('dialog').open, false); assert.equal(app.document.activeElement, app.get('help-button'));
});
