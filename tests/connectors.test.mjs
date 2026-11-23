import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { createElement, exportScene, hitTest, importScene, rotatePoint, unrotatedBounds } from '../src/scene.ts';
import { bindEndpoint, connectorPoints, setConnectorPoints, snapEndpoint, syncConnectors } from '../src/connectors.ts';
import { copyElements } from '../src/whiteboard/object-actions.ts';
import { pickHandle, selectionHandles } from '../src/whiteboard/canvas.ts';
import { initialState } from '../src/whiteboard/store.ts';
import { renderPaths } from '../src/strokes.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} should equal ${b}`);
const pointClose = (a, b) => { close(a.x, b.x); close(a.y, b.y); };
const shape = (type = 'rectangle', extra = {}) => ({ ...createElement(type, 350, 250, { roughness: 0 }), id: 'shape', width: 160, height: 100, ...extra });
const connector = (type = 'arrow', extra = {}) => ({ ...createElement(type, 510, 300, { roughness: 0 }), id: 'connector', width: 250, height: 100, points: [[0, 0], [250, 100]], ...extra });
function drag(app, from, to, finish = 'pointerup') {
  app.dispatch(app.canvas, 'pointerdown', { clientX: from.x, clientY: from.y });
  app.dispatch(app.canvas, 'pointermove', { clientX: to.x, clientY: to.y });
  if (finish) app.dispatch(app.canvas, finish);
}
const end = element => connectorPoints(element).at(-1);
function connected(type = 'rectangle', line = 'arrow', extra = {}) {
  const target = shape(type, extra), wire = connector(line);
  bindEndpoint(wire, 'startBinding', { x: 510, y: 300 }, [target]);
  syncConnectors([target, wire]);
  return [target, wire];
}

const arrowChoice = (app, label) => app.document.querySelector(`[role="group"][aria-label="Arrow type"] [aria-label="${label}"]`);

test('arrow type changes preserve bindings, reroute on drag, and survive undo, redo and import', () => {
  const target = shape(), wire = connector('arrow', { startBinding: { elementId: target.id, fixedPoint: [1, .5], focus: 0, gap: 0 } });
  const app = createApp({ savedElements: [target, wire] });
  drag(app, { x: 635, y: 350 }, { x: 635, y: 350 });
  assert.equal(arrowChoice(app, 'Straight').getAttribute('aria-pressed'), 'true');
  app.click(arrowChoice(app, 'Curved'));
  const curved = app.scene()[1];
  assert.equal(curved.arrowType, 'curved');
  assert.deepEqual(curved.points, [[0, 0], [100, 112.5], [250, 100]]);
  assert.equal(curved.startBinding.elementId, target.id);
  assert.match(renderPaths(curved)[0].d, /C/);
  assert.ok(hitTest(curved, { x: 691.25, y: 412.03 }, 2));
  assert.equal(hitTest(curved, { x: 635, y: 350 }, 2), false);
  app.click(arrowChoice(app, 'Right angle'));
  const right = app.scene()[1];
  assert.deepEqual(right.points, [[0, 0], [125, 0], [125, 100], [250, 100]]);
  assert.equal(right.roundness, null);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene()[1], curved);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene()[1], right);
  const imported = importScene(exportScene([target, right])).elements[1];
  assert.equal(imported.arrowType, right.arrowType);
  assert.deepEqual(imported.points, right.points);
  assert.deepEqual(imported.startBinding, right.startBinding);
  const reloaded = createApp({ savedElements: [target, right] });
  drag(reloaded, { x: 635, y: 350 }, { x: 635, y: 350 });
  drag(reloaded, { x: 760, y: 400 }, { x: 800, y: 470 });
  assert.deepEqual(reloaded.scene()[1].points, [[0, 0], [145, 0], [145, 170], [290, 170]]);
  drag(reloaded, { x: 430, y: 250 }, { x: 450, y: 290 });
  const moved = reloaded.scene()[1];
  assert.deepEqual(moved.points, [[0, 0], [135, 0], [135, 130], [270, 130]]);
  pointClose(end(moved), { x: 800, y: 470 });
  drag(reloaded, { x: 665, y: 400 }, { x: 665, y: 400 });
  reloaded.click(arrowChoice(reloaded, 'Straight'));
  assert.deepEqual(reloaded.scene()[1].points, [[0, 0], [270, 130]]);
});

test('the Arrow tool remembers its type across reload and leaves the Line tool straight', () => {
  const app = createApp({ savedLocal: { preferences: { arrowBinding: false } } });
  app.tool('arrow');
  app.click(arrowChoice(app, 'Curved'));
  app.scene();
  const { local } = JSON.parse(app.window.localStorage.getItem('sketchify.scene.v1'));
  const reloaded = createApp({ savedLocal: local });
  reloaded.tool('arrow');
  assert.equal(arrowChoice(reloaded, 'Curved').getAttribute('aria-pressed'), 'true');
  drag(reloaded, { x: 500, y: 320 }, { x: 700, y: 320 });
  assert.deepEqual(reloaded.scene()[0].points, [[0, 0], [100, 50], [200, 0]]);
  drag(reloaded, { x: 700, y: 320 }, { x: 700, y: 400 });
  assert.deepEqual(reloaded.scene()[0].points, [[0, 0], [80, 90], [200, 80]]);
  reloaded.tool('line');
  assert.equal(arrowChoice(reloaded, 'Curved'), null);
  drag(reloaded, { x: 500, y: 520 }, { x: 700, y: 570 });
  assert.deepEqual(reloaded.scene()[1].points, [[0, 0], [200, 50]]);
  reloaded.tool('arrow');
  reloaded.click(arrowChoice(reloaded, 'Right angle'));
  reloaded.canvas.focus();
  reloaded.key('Enter');
  assert.deepEqual(reloaded.scene()[2].points, [[0, 0], [80, 0], [80, 100], [160, 100]]);
});

test('a rotated arrow shows its endpoints and existing bend as its only handles', () => {
  const wire = connector('arrow', { points: [[0, 0], [0, 100], [250, 100]], angle: Math.PI / 4 });
  const [tail, bend, head] = connectorPoints(wire);
  const state = { ...initialState(), elements: [wire], selected: new Set([wire.id]), zoom: 2 };
  const handles = selectionHandles(state);
  assert.deepEqual(handles.map(handle => handle.key), ['startBinding', 'bend', 'endBinding']);
  handles.forEach((handle, index) => pointClose(handle, [tail, bend, head][index]));
  assert.equal(pickHandle(state, { x: bend.x + 4, y: bend.y }).key, 'bend');
  const box = unrotatedBounds(wire), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const oldCorner = rotatePoint({ x: box.x + box.width, y: box.y }, center, wire.angle);
  assert.equal(pickHandle(state, oldCorner), undefined);
});

test('moving a right-angle segment keeps both bound endpoints and stays orthogonal when a target moves', () => {
  const first = shape(), second = shape('rectangle', { id: 'second', x: 760, y: 350 });
  const wire = connector('arrow', { arrowType: 'right-angle', points: [[0, 0], [125, 0], [125, 100], [250, 100]] });
  bindEndpoint(wire, 'startBinding', { x: 510, y: 300 }, [first, second]);
  bindEndpoint(wire, 'endBinding', { x: 760, y: 400 }, [first, second]);
  const app = createApp({ savedElements: [first, second, wire] });
  const original = app.scene();
  const middle = { x: 635, y: 350 };
  app.click(app.canvas, { clientX: middle.x, clientY: middle.y });
  drag(app, middle, { x: 680, y: 380 }, 'pointercancel');
  assert.deepEqual(app.scene(), original);
  drag(app, middle, { x: 680, y: 380 });
  const bent = app.scene();
  assert.deepEqual(bent[2].points, [[0, 0], [170, 0], [170, 100], [250, 100]]);
  assert.deepEqual(bent[2].startBinding, original[2].startBinding);
  assert.deepEqual(bent[2].endBinding, original[2].endBinding);
  const restored = importScene(exportScene(bent)).elements;
  assert.equal(restored[2].manualBend, true);
  const reloaded = createApp({ savedElements: restored });
  drag(reloaded, { x: 840, y: 350 }, { x: 860, y: 380 });
  assert.deepEqual(reloaded.scene()[2].points, [[0, 0], [170, 0], [170, 130], [270, 130]]);
});

for (const { wire, middle, to, points } of [
  { wire: connector('arrow', { arrowType: 'right-angle', points: [[0, 0], [250, 0]] }),
    middle: { x: 635, y: 300 }, to: { x: 670, y: 365 }, points: [[0, 0], [0, 65], [250, 65], [250, 0]] },
  { wire: connector('arrow', { elbowed: true, points: [[0, 0], [0, 100], [250, 100]] }),
    middle: { x: 510, y: 350 }, to: { x: 560, y: 380 }, points: [[0, 0], [50, 0], [50, 100], [250, 100]] },
]) test(`dragging the midpoint bends an ${wire.elbowed ? 'imported L-shaped' : 'aligned'} right-angle arrow`, () => {
  const app = createApp({ savedElements: [wire] });
  app.click(app.canvas, { clientX: middle.x, clientY: middle.y });
  drag(app, middle, to);
  assert.deepEqual(app.scene()[0].points, points);
});

for (const type of ['straight', 'curved']) test(`a ${type} arrow bend keeps both attachments and survives endpoint changes and export`, () => {
  const first = shape(), second = shape('rectangle', { id: 'second', x: 760, y: 350 });
  const wire = connector('arrow', { arrowType: type, angle: Math.PI / 8 });
  setConnectorPoints(wire, [{ x: 510, y: 300 }, ...(type === 'curved' ? [{ x: 615, y: 390 }] : []), { x: 760, y: 400 }]);
  bindEndpoint(wire, 'startBinding', { x: 510, y: 300 }, [first, second]);
  bindEndpoint(wire, 'endBinding', { x: 760, y: 400 }, [first, second]);
  const app = createApp({ savedElements: [first, second, wire] });
  const original = app.scene();
  const center = type === 'curved' ? { x: 615, y: 390 } : { x: 635, y: 350 };
  app.click(app.canvas, { clientX: center.x, clientY: center.y });
  const bend = { x: 620, y: 470 };
  drag(app, center, { x: center.x + 1, y: center.y + 1 }, 'pointercancel');
  assert.deepEqual(app.scene(), original);
  drag(app, center, bend, 'pointercancel');
  assert.deepEqual(app.scene(), original);
  drag(app, center, bend);
  const bent = app.scene()[2];
  const [tail, vertex, head] = connectorPoints(bent);
  pointClose(tail, { x: 510, y: 300 }); pointClose(vertex, bend); pointClose(head, { x: 760, y: 400 });
  assert.deepEqual(bent.startBinding, original[2].startBinding);
  assert.deepEqual(bent.endBinding, original[2].endBinding);
  const restored = importScene(exportScene(app.scene())).elements;
  assert.equal(restored[2].manualBend, true);
  const reloaded = createApp({ savedElements: restored });
  drag(reloaded, { x: 840, y: 350 }, { x: 860, y: 380 });
  const points = connectorPoints(reloaded.scene()[2]);
  pointClose(points[1], bend); pointClose(points[2], { x: 780, y: 430 });
});

for (const type of ['rectangle', 'ellipse', 'diamond']) for (const line of ['line', 'arrow']) test(`${line} snaps both endpoints to ${type} edges and follows dragging and keyboard nudges`, () => {
  const first = shape(type), second = shape(type, { id: 'second', x: 750 });
  const app = createApp({ savedElements: [first, second] });
  app.tool(line);
  drag(app, { x: 517, y: 300 }, { x: 743, y: 300 });
  let [a, b, wire] = app.scene();
  assert.equal(wire.startBinding.elementId, a.id); assert.equal(wire.endBinding.elementId, b.id);
  pointClose(connectorPoints(wire)[0], { x: 510, y: 300 }); pointClose(end(wire), { x: 750, y: 300 });
  assert.ok(a.boundElements.some(ref => ref.id === wire.id));
  const fixed = structuredClone(wire.startBinding.fixedPoint);
  drag(app, { x: 430, y: 250 }, { x: 460, y: 290 });
  [a, b, wire] = app.scene();
  pointClose(connectorPoints(wire)[0], { x: 540, y: 340 }); pointClose(end(wire), { x: 750, y: 300 });
  assert.deepEqual(wire.startBinding.fixedPoint, fixed);
  app.key('ArrowRight', { shiftKey: true });
  pointClose(connectorPoints(app.scene()[2])[0], { x: 550, y: 340 });
  app.click(app.get('undo-button')); pointClose(connectorPoints(app.scene()[2])[0], { x: 540, y: 340 });
  app.click(app.get('redo-button')); pointClose(connectorPoints(app.scene()[2])[0], { x: 550, y: 340 });
});

test('fixed edge positions survive shape resizing and rotation, updating during the gesture', () => {
  const app = createApp({ savedElements: connected() });
  app.click(app.canvas, { clientX: 430, clientY: 250 });
  drag(app, { x: 510, y: 350 }, { x: 590, y: 410 }, null);
  app.dispatch(app.window, 'beforeunload');
  let [target, wire] = app.scene();
  pointClose(connectorPoints(wire)[0], { x: 590, y: 330 });
  pointClose(end(wire), { x: 760, y: 400 });
  app.dispatch(app.canvas, 'pointerup');
  const state = { ...initialState(), elements: app.scene(), selected: new Set(['shape']) };
  const handle = selectionHandles(state).find(handle => handle.key === 'rotate');
  const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  drag(app, handle, rotatePoint(handle, center, Math.PI / 2), null);
  app.dispatch(app.window, 'beforeunload');
  [target, wire] = app.scene();
  pointClose(connectorPoints(wire)[0], { x: center.x, y: center.y + target.width / 2 });
  app.dispatch(app.canvas, 'pointerup');
  const rotated = app.scene();
  app.click(app.get('undo-button')); close(app.scene()[0].angle, 0);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene(), rotated);
});

test('endpoint handles attach, detach and reconnect existing arrows, with cancellation and undo', () => {
  const target = shape(), wire = connector('arrow', { x: 580, y: 450, points: [[0, 0], [180, -50]] });
  const app = createApp({ savedElements: [target, wire] });
  app.click(app.canvas, { clientX: 670, clientY: 425 });
  drag(app, { x: 580, y: 450 }, { x: 516, y: 300 });
  let attached = app.scene(); assert.equal(attached[1].startBinding.elementId, target.id);
  pointClose(connectorPoints(attached[1])[0], { x: 510, y: 300 });
  drag(app, { x: 510, y: 300 }, { x: 600, y: 460 }, 'pointercancel');
  assert.deepEqual(app.scene(), attached);
  drag(app, { x: 510, y: 300 }, { x: 600, y: 460 });
  assert.equal(app.scene()[1].startBinding, null); assert.equal(app.scene()[0].boundElements, null);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), attached);
  app.click(app.canvas, { clientX: 635, clientY: 350 });
  drag(app, { x: 510, y: 300 }, { x: 430, y: 242 });
  attached = app.scene(); pointClose(connectorPoints(attached[1])[0], { x: 430, y: 250 });
  assert.equal(attached[1].startBinding.elementId, target.id);
});

test('cancelling shape transforms restores the attached path and binding', () => {
  const app = createApp({ savedElements: connected('diamond') });
  const original = app.scene();
  drag(app, { x: 430, y: 250 }, { x: 470, y: 290 }, 'pointercancel');
  assert.deepEqual(app.scene(), original);
  app.click(app.canvas, { clientX: 430, clientY: 250 });
  drag(app, { x: 510, y: 350 }, { x: 590, y: 410 }, 'pointercancel');
  assert.deepEqual(app.scene(), original);
});

test('moving a connected diagram together applies the translation once and keeps both bindings', () => {
  const elements = connected(), target = shape('ellipse', { id: 'second', x: 760, y: 350 });
  bindEndpoint(elements[1], 'endBinding', { x: 760, y: 400 }, [target]); elements.push(target); syncConnectors(elements);
  const app = createApp({ savedElements: elements });
  app.canvas.focus(); app.key('a', { ctrlKey: true }); const original = app.scene();
  drag(app, { x: 430, y: 250 }, { x: 470, y: 280 });
  const moved = app.scene(), points = connectorPoints(original[1]);
  connectorPoints(moved[1]).forEach((point, index) => pointClose(point, { x: points[index].x + 40, y: points[index].y + 30 }));
  assert.deepEqual(moved[1].startBinding, original[1].startBinding); assert.deepEqual(moved[1].endBinding, original[1].endBinding);
});

test('deleting a target leaves a detached line; undo restores the connection', () => {
  const app = createApp({ savedElements: connected('ellipse', 'line') }); const original = app.scene();
  app.click(app.canvas, { clientX: 430, clientY: 250 }); app.key('Delete');
  assert.equal(app.scene().length, 1); assert.equal(app.scene()[0].startBinding, null);
  pointClose(connectorPoints(app.scene()[0])[0], connectorPoints(original[1])[0]);
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), original);
});

test('copy and duplicate remap internal connections and discard references outside the copied selection', () => {
  const elements = connected();
  const copies = copyElements(elements, { x: 20, y: 30 }); syncConnectors(copies);
  assert.equal(copies[1].startBinding.elementId, copies[0].id);
  assert.ok(copies[0].boundElements.some(ref => ref.id === copies[1].id));
  pointClose(connectorPoints(copies[1])[0], { x: 530, y: 330 });
  assert.equal(copyElements([elements[1]], { x: 20, y: 20 })[0].startBinding, null);
  assert.deepEqual(copyElements([elements[0]], { x: 20, y: 20 })[0].boundElements, []);
});

test('bindings survive editable export/import and reload and reject invalid target references', () => {
  const elements = connected('ellipse'), imported = importScene(exportScene(elements)).elements;
  assert.deepEqual(imported[1].startBinding, elements[1].startBinding);
  const app = createApp({ savedElements: imported });
  drag(app, { x: 430, y: 250 }, { x: 450, y: 280 });
  pointClose(connectorPoints(app.scene()[1])[0], { x: 530, y: 330 });
  const invalid = importScene({ elements: [connector('line', { startBinding: { elementId: 'missing', fixedPoint: [1, .5] } })] }).elements;
  assert.equal(invalid[0].startBinding, null);
  const malformed = importScene({ elements: [shape(), connector('line', { startBinding: { elementId: 'shape', fixedPoint: [Infinity, 'bad'] } })] }).elements;
  syncConnectors(malformed); assert.ok(malformed[1].startBinding.fixedPoint.every(Number.isFinite));
});

test('snapping uses screen distance at any zoom, respects rotated outlines and ignores bounding-box corners of circles and diamonds', () => {
  for (const type of ['ellipse', 'diamond']) {
    const target = shape(type);
    assert.equal(snapEndpoint([target], { x: 510, y: 250 }), null);
    assert.ok(snapEndpoint([target], { x: 516, y: 300 }, 2));
    assert.equal(snapEndpoint([target], { x: 518, y: 300 }, 2), null);
    target.angle = Math.PI / 2;
    const rotated = rotatePoint({ x: 510, y: 300 }, { x: 430, y: 300 }, target.angle);
    pointClose(snapEndpoint([target], rotated).point, rotated);
  }
});

test('rounded rectangle attachments lie on the visible corner, including after resizing', () => {
  const target = shape('rectangle', { roundness: { type: 3, value: 32 } });
  const snapped = snapEndpoint([target], { x: 350, y: 250 }); assert.ok(snapped);
  close(Math.hypot(snapped.point.x - 375, snapped.point.y - 275), 25);
  const wire = connector(); bindEndpoint(wire, 'startBinding', snapped.point, [target]);
  target.width = 320; target.height = 200; syncConnectors([target, wire]);
  const point = connectorPoints(wire)[0]; close(Math.hypot(point.x - 382, point.y - 282), 32);
});

test('changing one endpoint of a rotated path preserves its angle, other endpoint, and bend positions', () => {
  const wire = connector('line', { angle: Math.PI / 3, points: [[0, 0], [100, 80], [250, 100]] });
  const before = connectorPoints(wire), next = [...before]; next[0] = { x: 200, y: 100 };
  setConnectorPoints(wire, next);
  close(wire.angle, Math.PI / 3); connectorPoints(wire).forEach((point, index) => pointClose(point, next[index]));
  assert.ok(unrotatedBounds(wire).width > 0);
});

test('connector dragging uses the original path on each pointer update', () => {
  const elements = connected(), target = shape('rectangle', { id: 'second', x: 760, y: 350 });
  bindEndpoint(elements[1], 'endBinding', { x: 760, y: 400 }, [target]); elements.push(target); syncConnectors(elements);
  const move = intermediate => {
    const app = createApp({ savedElements: elements });
    app.click(app.canvas, { clientX: 585, clientY: 330 });
    app.dispatch(app.canvas, 'pointerdown', { clientX: 585, clientY: 330 });
    if (intermediate) app.dispatch(app.canvas, 'pointermove', { clientX: 593, clientY: 334 });
    app.dispatch(app.canvas, 'pointermove', { clientX: 625, clientY: 350 });
    app.dispatch(app.canvas, 'pointerup'); return app.scene()[1];
  };
  const direct = move(false), stepped = move(true);
  assert.deepEqual(stepped.points, direct.points); close(stepped.x, direct.x); close(stepped.y, direct.y);
  assert.equal(stepped.startBinding, null); assert.equal(stepped.endBinding, null);
});

test('cancelling a shape move restores an attached rotated connector exactly', () => {
  const target = shape(), wire = connector('arrow', { angle: Math.PI / 3 });
  bindEndpoint(wire, 'startBinding', { x: 510, y: 300 }, [target]); syncConnectors([target, wire]);
  const app = createApp({ savedElements: [target, wire] }); const original = app.scene();
  drag(app, { x: 430, y: 250 }, { x: 470, y: 290 }, 'pointercancel');
  assert.deepEqual(app.scene(), original);
});

test('cancelling a new attached arrow removes temporary references from the shape', () => {
  const app = createApp({ savedElements: [shape()] }); const original = app.scene();
  app.tool('arrow'); drag(app, { x: 517, y: 300 }, { x: 650, y: 400 }, 'pointercancel');
  assert.deepEqual(app.scene(), original);
});

test('label growth moves attached endpoints and preserves text and connector references together', () => {
  const app = createApp({ savedElements: connected() }); const before = app.scene();
  app.dispatch(app.canvas, 'dblclick', { clientX: 430, clientY: 250 });
  app.input('A long label\nwith several lines\nthat expands\nthe shape'); app.key('Enter', { ctrlKey: true });
  const [target, wire, text] = app.scene();
  assert.ok(target.height > before[0].height);
  pointClose(connectorPoints(wire)[0], { x: target.x + target.width, y: target.y + target.height / 2 });
  pointClose(end(wire), end(before[1]));
  assert.ok(target.boundElements.some(ref => ref.id === wire.id));
  assert.ok(target.boundElements.some(ref => ref.id === text.id));
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), before);
});

test('edge snapping takes precedence over the alignment grid at higher zoom', () => {
  const app = createApp({ savedElements: [shape(), shape('ellipse', { id: 'second', x: 650 })], zoom: 2, savedLocal: { grid: true } });
  app.tool('line'); drag(app, { x: 516 * 2, y: 600 }, { x: 646 * 2, y: 600 });
  const [first, second, wire] = app.scene();
  assert.equal(wire.startBinding.elementId, first.id); assert.equal(wire.endBinding.elementId, second.id);
  pointClose(connectorPoints(wire)[0], { x: 510, y: 300 }); pointClose(end(wire), { x: 650, y: 300 });
});

for (const type of ['rectangle', 'ellipse', 'diamond', 'text']) test(`both endpoints attach to the ${type} center and follow transforms and reload`, () => {
  const target = shape(type, { text: type === 'text' ? 'Center target' : '', roundness: { type: 3, value: 32 } });
  const wire = connector();
  for (const key of ['startBinding', 'endBinding']) {
    bindEndpoint(wire, key, { x: 434, y: 303 }, [target]);
    assert.deepEqual(wire[key].fixedPoint, [.5, .5]);
  }
  syncConnectors([target, wire]);
  connectorPoints(wire).forEach(point => pointClose(point, { x: 430, y: 300 }));
  Object.assign(target, { x: 380, y: 290, width: 240, height: 180, angle: Math.PI / 3 });
  syncConnectors([target, wire]);
  connectorPoints(wire).forEach(point => pointClose(point, { x: 500, y: 380 }));
  const restored = importScene(exportScene([target, wire])).elements;
  syncConnectors(restored);
  assert.deepEqual(restored[1].startBinding, wire.startBinding);
  assert.deepEqual(restored[1].endBinding, wire.endBinding);
  connectorPoints(restored[1]).forEach(point => pointClose(point, { x: 500, y: 380 }));
});

test('center snapping uses screen distance, prioritizes centers on small targets, and ignores bound labels', () => {
  const target = shape();
  for (const zoom of [.5, 1, 2, 5]) {
    const snapped = snapEndpoint([target], { x: 430 + 13 / zoom, y: 300 }, zoom);
    pointClose(snapped.point, { x: 430, y: 300 });
    assert.deepEqual(snapped.binding.fixedPoint, [.5, .5]);
    assert.equal(snapEndpoint([target], { x: 430 + 15 / zoom, y: 300 }, zoom), null);
  }
  const small = shape('text', { width: 16, height: 20 });
  assert.deepEqual(snapEndpoint([small], { x: 360, y: 260 }).binding.fixedPoint, [.5, .5]);
  const label = shape('text', { id: 'label', containerId: target.id });
  assert.equal(snapEndpoint([target, label], { x: 430, y: 300 }).binding.elementId, target.id);
  assert.equal(snapEndpoint([{ ...target, isDeleted: true }], { x: 430, y: 300 }), null);
  for (const type of ['image', 'frame', 'arrow']) assert.equal(snapEndpoint([shape(type)], { x: 430, y: 300 }), null);
});

test('drawing from a shape center to a text center shows hints, honors the grid and zoom, and survives undo and reload', () => {
  const app = createApp({ savedElements: [shape('rectangle', { roundness: { type: 3, value: 32 } }), shape('text', { id: 'text', x: 750, y: 350, text: 'Arrow target', fontFamily: 2 })], zoom: 2, pan: { x: -300, y: -200 }, savedLocal: { grid: true } });
  const text = app.scene()[1], center = { x: text.x + text.width / 2, y: text.y + text.height / 2 };
  const screen = point => ({ clientX: point.x * 2 - 300, clientY: point.y * 2 - 200 });
  const hint = app.get('connector-center-hint');
  app.tool('arrow');
  app.dispatch(app.canvas, 'pointermove', screen({ x: 433, y: 302 }));
  assert.equal(hint.hidden, false); assert.equal(hint.textContent, '');
  assert.equal(hint.style.left, '560px'); assert.equal(hint.style.top, '400px');
  assert.equal(hint.getAttribute('aria-hidden'), 'true');
  app.dispatch(app.canvas, 'pointerdown', screen({ x: 433, y: 302 }));
  app.dispatch(app.canvas, 'pointermove', screen({ x: center.x - 3, y: center.y + 2 }));
  assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointerup'); assert.equal(hint.hidden, true);
  const elements = app.scene(), wire = elements[2];
  assert.equal(wire.startBinding.elementId, 'shape'); assert.equal(wire.endBinding.elementId, 'text');
  pointClose(connectorPoints(wire)[0], { x: 430, y: 300 }); pointClose(end(wire), center);
  app.click(app.get('undo-button')); assert.equal(app.scene().length, 2);
  app.click(app.get('redo-button')); assert.deepEqual(app.scene(), elements);
  const reloaded = createApp({ savedElements: elements });
  assert.deepEqual(reloaded.scene()[2], wire);
});

test('dragging either existing endpoint shows the center hint, attaches, detaches and cancels', () => {
  const app = createApp({ savedElements: [shape(), shape('text', { id: 'text', x: 750, y: 550, text: 'Text center', fontFamily: 2 }), connector('arrow', { x: 580, y: 450, points: [[0, 0], [180, -50]] })] });
  const text = app.scene()[1], center = { x: text.x + text.width / 2, y: text.y + text.height / 2 };
  const hint = app.get('connector-center-hint');
  app.click(app.canvas, { clientX: 670, clientY: 425 });
  drag(app, { x: 580, y: 450 }, { x: 435, y: 304 }, null);
  assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointerup'); assert.equal(hint.hidden, true);
  pointClose(connectorPoints(app.scene()[2])[0], { x: 430, y: 300 });
  const before = app.scene();
  drag(app, { x: 760, y: 400 }, { x: center.x + 4, y: center.y - 3 }, null);
  assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointercancel'); assert.equal(hint.hidden, true);
  assert.deepEqual(app.scene(), before);
  drag(app, { x: 760, y: 400 }, { x: center.x + 4, y: center.y - 3 });
  let wire = app.scene()[2]; pointClose(end(wire), center); assert.deepEqual(wire.endBinding.fixedPoint, [.5, .5]);
  drag(app, center, { x: 650, y: 650 });
  wire = app.scene()[2]; assert.equal(wire.endBinding, null); pointClose(end(wire), { x: 650, y: 650 });
  app.click(app.get('undo-button')); pointClose(end(app.scene()[2]), center);
});

test('center hints clear on leaving, changing tools, panning, and disabling arrow binding', () => {
  const app = createApp({ savedElements: [shape()] }), hint = app.get('connector-center-hint');
  const hover = () => app.dispatch(app.canvas, 'pointermove', { clientX: 434, clientY: 303 });
  app.tool('arrow'); hover(); assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointerleave'); assert.equal(hint.hidden, true);
  hover(); app.tool('rectangle'); assert.equal(hint.hidden, true);
  app.tool('line'); hover(); assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointerdown', { clientX: 434, clientY: 303, button: 1 }); assert.equal(hint.hidden, true);
  app.dispatch(app.canvas, 'pointerup');
  app.click(app.get('menu-button')); app.click(app.get('menu').querySelector('[data-action="preferences"]'));
  app.click(app.get('preference-arrowBinding'));
  app.key('Escape'); app.tool('arrow'); hover(); assert.equal(hint.hidden, true);
  drag(app, { x: 434, y: 303 }, { x: 650, y: 400 });
  assert.equal(app.scene()[1].startBinding, undefined);
});

test('editing connected text keeps the endpoint at its new center in one undo step', () => {
  const app = createApp({ savedElements: [shape('text', { text: 'Text', fontFamily: 2 })] });
  const text = app.scene()[0], center = { x: text.x + text.width / 2, y: text.y + text.height / 2 };
  app.tool('arrow'); drag(app, { x: 650, y: 500 }, center);
  const before = app.scene();
  app.dispatch(app.canvas, 'dblclick', { clientX: text.x + 3, clientY: text.y + 3 });
  app.input('A much longer text target\nwith a second line'); app.key('Enter', { ctrlKey: true });
  const [updated, wire] = app.scene();
  pointClose(end(wire), { x: updated.x + updated.width / 2, y: updated.y + updated.height / 2 });
  assert.deepEqual(wire.endBinding.fixedPoint, [.5, .5]);
  assert.ok(updated.boundElements.some(ref => ref.id === wire.id));
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), before);
});

test('the hint confirms the actual center attachment when the grid rounds an endpoint into snap range', () => {
  const app = createApp({ savedElements: [shape()], savedLocal: { grid: true } });
  app.tool('arrow'); drag(app, { x: 650, y: 400 }, { x: 449, y: 303 }, null);
  assert.equal(app.get('connector-center-hint').hidden, false);
  app.dispatch(app.canvas, 'pointerup'); pointClose(end(app.scene()[1]), { x: 430, y: 300 });
  drag(app, { x: 430, y: 300 }, { x: 449, y: 303 }, null);
  assert.equal(app.get('connector-center-hint').hidden, false);
  app.dispatch(app.canvas, 'pointerup'); pointClose(end(app.scene()[1]), { x: 430, y: 300 });
});

for (const type of ['rectangle', 'ellipse', 'diamond', 'text']) test(`${type} side midpoints snap exactly and follow resize, rotation and export`, () => {
  const target = shape(type, { text: type === 'text' ? 'Text target' : '', roundness: { type: 3, value: 32 } });
  const midpoints = type === 'diamond' ? [[.25, .25], [.75, .25], [.75, .75], [.25, .75]] : [[.5, 0], [1, .5], [.5, 1], [0, .5]];
  for (const zoom of [.5, 1, 2, 5]) for (const fixedPoint of midpoints) {
    const point = { x: target.x + fixedPoint[0] * target.width, y: target.y + fixedPoint[1] * target.height };
    const snapped = snapEndpoint([target], { x: point.x + 6 / zoom, y: point.y + 4 / zoom }, zoom);
    pointClose(snapped.point, point); assert.deepEqual(snapped.binding.fixedPoint, fixedPoint); assert.equal(snapped.hint, 'midpoint');
    const wire = connector();
    bindEndpoint(wire, 'startBinding', point, [target]); bindEndpoint(wire, 'endBinding', point, [target]);
    const transformed = { ...target, x: 400, y: 300, width: 240, height: 180, angle: Math.PI / 3 };
    syncConnectors([transformed, wire]);
    const expected = rotatePoint({ x: 400 + fixedPoint[0] * 240, y: 300 + fixedPoint[1] * 180 }, { x: 520, y: 390 }, transformed.angle);
    connectorPoints(wire).forEach(endpoint => pointClose(endpoint, expected));
    const restored = importScene(exportScene([transformed, wire])).elements; syncConnectors(restored);
    connectorPoints(restored[1]).forEach(endpoint => pointClose(endpoint, expected));
    const rotatedSnap = snapEndpoint([transformed], { x: expected.x + 3 / zoom, y: expected.y - 2 / zoom }, zoom);
    pointClose(rotatedSnap.point, expected); assert.equal(rotatedSnap.hint, 'midpoint');
  }
});

test('side midpoint attraction ends outside its screen range while ordinary edge binding stays available', () => {
  const target = shape();
  for (const zoom of [.5, 1, 2, 5]) {
    const near = snapEndpoint([target], { x: 430 + 13 / zoom, y: 250 }, zoom);
    pointClose(near.point, { x: 430, y: 250 }); assert.equal(near.hint, 'midpoint');
    const outside = snapEndpoint([target], { x: 430 + 15 / zoom, y: 250 }, zoom);
    pointClose(outside.point, { x: 430 + 15 / zoom, y: 250 }); assert.equal(outside.hint, null);
  }
  const smallText = shape('text', { width: 100, height: 20 });
  const nearest = snapEndpoint([smallText], { x: 402, y: 250 });
  pointClose(nearest.point, { x: 400, y: 250 }); assert.equal(nearest.hint, 'midpoint');
});

test('drawing and dragging either endpoint snaps to side midpoints and shows the matching hint', () => {
  const app = createApp({ savedElements: [shape(), shape('text', { id: 'text', x: 750, y: 400, text: 'Text target', fontFamily: 2 })] });
  const text = app.scene()[1], top = { x: text.x + text.width / 2, y: text.y };
  const hint = app.get('connector-center-hint');
  app.tool('arrow'); app.dispatch(app.canvas, 'pointermove', { clientX: 437, clientY: 246 });
  assert.equal(hint.hidden, false); assert.equal(hint.textContent, '');
  drag(app, { x: 437, y: 246 }, { x: top.x + 5, y: top.y - 3 }, null);
  assert.equal(hint.hidden, false); assert.equal(hint.textContent, '');
  app.dispatch(app.canvas, 'pointerup'); assert.equal(hint.hidden, true);
  let wire = app.scene()[2]; pointClose(connectorPoints(wire)[0], { x: 430, y: 250 }); pointClose(end(wire), top);
  assert.deepEqual(wire.startBinding.fixedPoint, [.5, 0]); assert.deepEqual(wire.endBinding.fixedPoint, [.5, 0]);
  drag(app, { x: 430, y: 250 }, { x: 516, y: 306 }, null);
  assert.equal(hint.textContent, ''); assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointerup'); pointClose(connectorPoints(app.scene()[2])[0], { x: 510, y: 300 });
  const before = app.scene();
  drag(app, top, { x: 424, y: 354 }, null);
  assert.equal(hint.textContent, ''); assert.equal(hint.hidden, false);
  app.dispatch(app.canvas, 'pointercancel'); assert.equal(hint.hidden, true); assert.deepEqual(app.scene(), before);
  drag(app, top, { x: 424, y: 354 }); wire = app.scene()[2]; pointClose(end(wire), { x: 430, y: 350 });
  app.click(app.get('undo-button')); assert.deepEqual(app.scene(), before);
});
