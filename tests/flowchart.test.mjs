import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './helpers/app.mjs';
import { connectorPoints } from '../src/connectors.ts';
import { exportScene, importScene } from '../src/scene.ts';
import { mkdir, writeFile } from 'node:fs/promises';

const source = (type = 'rectangle', extra = {}) => ({ id: 'source', type, x: 350, y: 250, width: 160, height: 100, ...extra });
function select(app) { app.canvas.focus(); app.key('a', { ctrlKey: true }); }
function release(app, modifier = 'Control') { app.dispatch(app.document, 'keyup', { key: modifier }); }
function create(app, direction = 'ArrowRight', modifier = 'ctrlKey') {
  assert.equal(app.key(direction, { [modifier]: true }).defaultPrevented, true); release(app);
  return app.scene();
}
function orthogonal(arrow) {
  const points = connectorPoints(arrow);
  for (let i = 1; i < points.length; i++) assert.ok(Math.abs(points[i].x - points[i - 1].x) < 1e-7 || Math.abs(points[i].y - points[i - 1].y) < 1e-7);
}

for (const type of ['rectangle', 'ellipse', 'diamond']) for (const modifier of ['ctrlKey', 'metaKey']) {
  test(`${modifier} + arrows creates styled, blank ${type} nodes in all directions`, () => {
    const app = createApp({ savedElements: [source(type, { strokeColor: '#1971c2', backgroundColor: '#a5d8ff', strokeWidth: 4, roughness: 2, opacity: 70, roundness: type === 'rectangle' ? { type: 3, value: 32 } : null })] });
    for (const [direction, dx, dy] of [['ArrowRight', 260, 0], ['ArrowDown', 0, 200], ['ArrowLeft', -260, 0], ['ArrowUp', 0, -200]]) {
      select(app); const original = app.scene()[0];
      const elements = create(app, direction, modifier), node = elements[1], arrow = elements[2];
      assert.equal(node.type, type); assert.equal(node.x, original.x + dx); assert.equal(node.y, original.y + dy);
      for (const key of ['width', 'height', 'strokeColor', 'backgroundColor', 'strokeWidth', 'roughness', 'opacity', 'roundness']) assert.deepEqual(node[key], original[key]);
      assert.notEqual(node.id, original.id); assert.equal(node.text, ''); assert.deepEqual(node.groupIds, []);
      assert.equal(arrow.type, 'arrow'); assert.equal(arrow.elbowed, true); assert.equal(arrow.endArrowhead, 'arrow');
      assert.equal(arrow.strokeColor, original.strokeColor); assert.equal(arrow.startBinding.elementId, original.id); assert.equal(arrow.endBinding.elementId, node.id);
      assert.ok(elements[0].boundElements.some(ref => ref.id === arrow.id)); assert.ok(node.boundElements.some(ref => ref.id === arrow.id)); orthogonal(arrow);
      app.key('z', { ctrlKey: true }); assert.deepEqual(app.scene(), [original]);
    }
  });
}

test('holding the modifier previews centered siblings without saving, then commits one undo step', () => {
  const app = createApp({ savedElements: [source()] }); select(app); const original = app.scene();
  for (let i = 0; i < 3; i++) { app.key('ArrowRight', { ctrlKey: true, repeat: i > 0 }); assert.deepEqual(app.scene(), original); }
  // Arrow keyup while Control remains held keeps the preview active.
  app.dispatch(app.document, 'keyup', { key: 'ArrowRight', ctrlKey: true }); assert.deepEqual(app.scene(), original);
  release(app); const elements = app.scene();
  assert.equal(elements.length, 7);
  assert.deepEqual(elements.filter(e => e.type === 'rectangle').slice(1).map(e => [e.x, e.y]), [[610, 50], [610, 250], [610, 450]]);
  elements.filter(e => e.type === 'arrow').forEach(orthogonal);
  app.key('ArrowDown'); assert.equal(app.scene()[1].y, 51); assert.equal(app.scene()[3].y, 250); // first child selected
  app.key('z', { ctrlKey: true }); app.key('z', { ctrlKey: true }); assert.deepEqual(app.scene(), original);
  app.key('z', { ctrlKey: true, shiftKey: true }); assert.deepEqual(app.scene(), elements);
});

test('separate shortcut presses extend the chart and moving a node keeps elbow arrows attached', () => {
  const app = createApp({ savedElements: [source()] }); select(app);
  create(app); const first = app.scene()[1];
  const elements = create(app, 'ArrowDown'); assert.equal(elements.length, 5);
  assert.equal(elements[3].x, first.x); assert.equal(elements[3].y, first.y + 200);
  assert.equal(elements[4].startBinding.elementId, first.id);
  app.key('ArrowRight', { shiftKey: true });
  const moved = app.scene(), arrow = moved[4]; orthogonal(arrow);
  assert.equal(arrow.endBinding.elementId, moved[3].id);
  const endpoint = connectorPoints(arrow).at(-1);
  assert.equal(endpoint.x, moved[3].x + moved[3].width / 2); assert.equal(endpoint.y, moved[3].y);
  const restored = createApp({ savedElements: importScene(exportScene(moved)).elements }); assert.deepEqual(JSON.parse(exportScene(restored.scene())), JSON.parse(exportScene(moved)));
});

test('changing direction replaces pending siblings and Escape discards them', () => {
  const app = createApp({ savedElements: [source()] }); select(app); const original = app.scene();
  app.key('ArrowRight', { metaKey: true }); app.key('ArrowRight', { metaKey: true }); app.key('ArrowDown', { metaKey: true }); release(app, 'Meta');
  assert.equal(app.scene().length, 3); assert.equal(app.scene()[1].y, 450);
  app.key('ArrowRight', { metaKey: true }); assert.equal(app.key('Escape', { metaKey: true }).defaultPrevented, true); release(app, 'Meta');
  assert.equal(app.scene().length, 3);
  app.key('z', { ctrlKey: true }); assert.deepEqual(app.scene(), original);
});

test('adding siblings to an existing chart avoids connected nodes', () => {
  const app = createApp({ savedElements: [source()] }); select(app); create(app);
  app.click(app.canvas, { clientX: 430, clientY: 250 }); create(app);
  const elements = app.scene(), existing = elements[1], added = elements[3];
  assert.equal(added.x, existing.x); assert.ok(Math.abs(added.y - existing.y) >= existing.height + 100);
  orthogonal(elements[4]);
});

test('bound labels are not copied and explicit flowchart arrows bind with automatic snapping disabled', () => {
  const app = createApp({ savedElements: [source('rectangle', { boundElements: [{ id: 'label', type: 'text' }] }), { id: 'label', type: 'text', text: 'Root label', containerId: 'source', x: 370, y: 270 }], savedLocal: { preferences: { arrowBinding: false } } });
  app.click(app.canvas, { clientX: 430, clientY: 250 }); const elements = create(app);
  assert.equal(elements.length, 4); assert.equal(elements[2].type, 'rectangle');
  assert.equal(elements[2].text, ''); assert.deepEqual(elements[2].boundElements, [{ id: elements[3].id, type: 'arrow' }]);
  assert.equal(elements[3].startBinding.elementId, 'source');
});

test('shortcuts leave editing fields, dialogs, shifted commands, selections and pointer gestures alone', () => {
  const app = createApp({ savedElements: [source()] }); select(app); const original = app.scene();
  for (const options of [{ ctrlKey: true, shiftKey: true }, { metaKey: true, altKey: true }]) {
    app.key('ArrowRight', options); release(app); assert.deepEqual(app.scene(), original);
  }
  app.key('Enter'); assert.equal(app.document.activeElement, app.editor);
  app.key('ArrowRight', { metaKey: true }); release(app); assert.deepEqual(app.scene(), original); app.key('Escape');
  app.key('?'); app.key('ArrowRight', { ctrlKey: true }); release(app); assert.deepEqual(app.scene(), original); app.key('Escape');
  app.dispatch(app.canvas, 'pointerdown', { clientX: 430, clientY: 250 });
  app.key('ArrowRight', { ctrlKey: true }); release(app); app.dispatch(app.canvas, 'pointercancel'); assert.deepEqual(app.scene(), original);
  app.key('Escape'); assert.equal(app.key('ArrowRight', { metaKey: true }).defaultPrevented, false); release(app); assert.deepEqual(app.scene(), original);
});

for (const type of ['text', 'line', 'arrow', 'frame']) test(`unsupported ${type} selections create no nodes`, () => {
  const app = createApp({ savedElements: [source(type, { text: 'Text', points: [[0, 0], [160, 100]] })] }); select(app); const original = app.scene();
  assert.equal(app.key('ArrowRight', { ctrlKey: true }).defaultPrevented, false); release(app); assert.deepEqual(app.scene(), original);
});

test('locked and multiple selections do not create nodes', () => {
  for (const elements of [[source('rectangle', { locked: true })], [source(), source('ellipse', { id: 'other', x: 650 })]]) {
    const app = createApp({ savedElements: elements });
    if (elements.length === 1) app.click(app.canvas, { clientX: 430, clientY: 250 }); else select(app);
    const original = app.scene(); app.key('ArrowRight', { ctrlKey: true }); release(app); assert.deepEqual(app.scene(), original);
  }
});

test('blur cancels pending nodes and pointer interaction finalizes them', () => {
  const app = createApp({ savedElements: [source()] }); select(app); const original = app.scene();
  app.key('ArrowRight', { ctrlKey: true }); app.dispatch(app.window, 'blur'); release(app); assert.deepEqual(app.scene(), original);
  app.key('ArrowRight', { ctrlKey: true }); app.click(app.canvas, { clientX: 900, clientY: 600 }); release(app); assert.equal(app.scene().length, 3);
  app.key('z', { ctrlKey: true }); assert.deepEqual(app.scene(), original);
});

test('rotated sources attach at their outline and repeated additions remain finite after reload', () => {
  for (const type of ['rectangle', 'ellipse', 'diamond']) {
    const app = createApp({ savedElements: [source(type, { angle: Math.PI / 3 })] }); select(app);
    const elements = create(app), arrow = elements[2]; orthogonal(arrow);
    assert.equal(elements[1].angle, 0); assert.ok(elements[1].x > elements[0].x + elements[0].width);
    assert.ok(arrow.startBinding.fixedPoint.every(value => value >= 0 && value <= 1));
    const restored = createApp({ savedElements: elements }); assert.deepEqual(restored.scene(), elements);
  }
});

test('new nodes inherit the source frame only when the entire cluster intersects it', () => {
  const app = createApp({ savedElements: [source('frame', { id: 'frame', x: 300, y: 200, width: 500, height: 500 }), source('rectangle', { frameId: 'frame' })] });
  app.click(app.canvas, { clientX: 430, clientY: 250 });
  let elements = create(app); assert.equal(elements[2].frameId, 'frame'); assert.equal(elements[3].frameId, 'frame');
  elements = create(app); assert.ok(!elements[4].frameId); assert.ok(!elements[5].frameId);
});

for (const theme of ['light', 'dark']) test(`pending siblings render on the ${theme} canvas without entering storage`, async () => {
  const app = createApp({ theme, width: 1000, height: 700, savedElements: [source('rectangle', { x: 180, y: 250, strokeColor: '#1971c2', backgroundColor: '#a5d8ff', fillStyle: 'solid', roundness: { type: 3, value: 24 } })] });
  select(app); const original = app.scene();
  const pixels = () => new Promise(resolve => app.canvas.toBlob(async blob => resolve(Buffer.from(await blob.arrayBuffer()))));
  const before = await pixels();
  app.key('ArrowRight', { ctrlKey: true }); app.key('ArrowRight', { ctrlKey: true }); app.key('ArrowRight', { ctrlKey: true });
  const preview = await pixels(); assert.notDeepEqual(preview, before); assert.deepEqual(app.scene(), original);
  const artifacts = new URL('../artifacts/', import.meta.url);
  await mkdir(artifacts, { recursive: true });
  await writeFile(new URL(`flowchart-${theme}-native.png`, artifacts), preview);
  app.key('Escape', { ctrlKey: true }); assert.deepEqual(await pixels(), before);
});
